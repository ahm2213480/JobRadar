import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { guessSkillCategory } from './IJobProvider';
import { clean, jobFingerprint } from './normalize';
import { ArbeitnowProvider } from './arbeitnow.adapter';
import { AdzunaProvider } from './adzuna.adapter';
import { JSearchProvider } from './jsearch.adapter';
import { RemoteOkProvider } from './remoteok.adapter';
import { RemotiveProvider } from './remotive.adapter';
import { WebSearchProvider } from './websearch.adapter';

/** Time between two manual "Sync now" triggers, to protect external APIs. */
export const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Prisma rejects Invalid Date objects outright — normalize at the boundary so
 * one malformed provider field can never abort a whole provider sync. */
function safeDate(value: Date | null | undefined): Date | null {
  return value && !Number.isNaN(value.getTime()) ? value : null;
}

/** Upper bound for the whole sync loop so one hanging provider cannot stall the endpoint forever. */
export const SYNC_OVERALL_TIMEOUT_MS = 120_000;

/** Upper bound for a single provider (fetch + ingest) before it is aborted. */
export const PROVIDER_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Retry once on transient Prisma connection errors (Neon sleeps when idle). */
const RETRYABLE_DB_CODES = new Set(['P1001', 'P1002', 'P2024']);
async function withDbRetry<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && RETRYABLE_DB_CODES.has(code)) {
      logger.warn(`[jobs] DB connection error (${code}) — retrying once`);
      return work();
    }
    throw error;
  }
}

export function normalizeCompanyName(name: string): string {
  // Remove common suffix noise ("GmbH", "Inc.", "LLC", "Ltd") so the same
  // company from multiple sources maps to a single normalized row.
  const withoutSuffix = clean(name).replace(
    /\b(gmbh|inc|llc|ltd|limited|corp|corporation|co|sarl|sas|holding)$/g,
    '',
  );
  return withoutSuffix.trim() || clean(name);
}

function ensureSourceSlug(slug: string): { name: string; baseUrl: string | null } {
  switch (slug) {
    case 'remotive':
      return { name: 'Remotive', baseUrl: 'https://remotive.com' };
    case 'remoteok':
      return { name: 'RemoteOK', baseUrl: 'https://remoteok.com' };
    case 'arbeitnow':
      return { name: 'Arbeitnow', baseUrl: 'https://arbeitnow.com' };
    case 'jsearch':
      return { name: 'JSearch (LinkedIn + boards)', baseUrl: 'https://www.linkedin.com/jobs/' };
    case 'adzuna':
      return { name: 'Adzuna', baseUrl: 'https://www.adzuna.com' };
    case 'websearch':
      return { name: 'Web search (Google Jobs)', baseUrl: 'https://www.google.com/search?q=jobs' };
    case 'manual':
      return { name: 'Manual / LinkedIn paste', baseUrl: null };
    default:
      return { name: slug, baseUrl: null };
  }
}

/** Idempotently creates the known sources so seed data exists on first boot. */
export async function ensureSources(): Promise<void> {
  for (const slug of ['remotive', 'remoteok', 'arbeitnow', 'jsearch', 'adzuna', 'websearch', 'manual']) {
    const { name, baseUrl } = ensureSourceSlug(slug);
    await prisma.jobSource.upsert({
      where: { slug },
      update: { name, baseUrl },
      create: { slug, name, baseUrl, isActive: true },
    });
  }
}

interface StoredSkill {
  id: string;
  name: string;
  aliases: string[];
}

/**
 * Loads the skill vocabulary once per ingestion run and reuses it for every
 * job — the old code ran a full-table `skill.findMany` per job (N+1 pattern).
 * Newly promoted skills are added to the in-memory cache immediately so a
 * later job in the same run sees them without another DB round-trip.
 */
class SkillLinker {
  private skills: StoredSkill[] = [];
  /** lowercase canonical name or alias → skill row */
  private byTerm = new Map<string, StoredSkill>();
  private loaded = false;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.skills = (await prisma.skill.findMany({
      select: { id: true, name: true, aliases: true },
    })) as StoredSkill[];
    for (const skill of this.skills) {
      for (const term of [skill.name, ...skill.aliases]) {
        this.byTerm.set(term.trim().toLowerCase(), skill);
      }
    }
    this.loaded = true;
  }

  /**
   * Links a job to every skill whose canonical name or one of its aliases
   * appears in the job text. Unknown technical tags are promoted to new Skill
   * rows so the vocabulary grows with the data instead of remaining static.
   */
  async link(jobId: string, text: string, requiredNames: string[] = []): Promise<void> {
    await this.ensureLoaded();

    const lowerText = text.toLowerCase();
    const reqLookup = new Set(requiredNames.map((n) => n.trim().toLowerCase()).filter(Boolean));

    const matchedSkills = new Map<string, boolean>(); // skillId → isRequired
    for (const skill of this.skills) {
      const terms = [skill.name, ...skill.aliases].map((term) => term.trim().toLowerCase()).filter(Boolean);
      if (terms.some((term) => lowerText.includes(term))) {
        matchedSkills.set(skill.id, reqLookup.has(skill.name.toLowerCase()));
      }
    }

    // Promote tags that look like technologies but aren't known skills yet.
    for (const term of extractCandidateTerms(text).slice(0, 30)) {
      if (matchedSkills.size >= 50) break;
      const known = this.byTerm.get(term);
      if (known) {
        if (!matchedSkills.has(known.id)) matchedSkills.set(known.id, false);
        continue;
      }
      const created = await this.createSkill(term);
      if (!matchedSkills.has(created.id)) matchedSkills.set(created.id, false);
    }

    if (matchedSkills.size === 0) return;

    // Upsert the job→skill links in one cheap transaction per job.
    await prisma.$transaction(
      [...matchedSkills.entries()].map(([skillId, isRequired]) =>
        prisma.jobSkill.upsert({
          where: { jobId_skillId: { jobId, skillId } },
          update: { isRequired },
          create: { jobId, skillId, isRequired },
        }),
      ),
    );
  }

  /** Creates a new skill row (or adopts one created by a concurrent run). */
  private async createSkill(term: string): Promise<StoredSkill> {
    const existing = await prisma.skill.findFirst({
      where: { name: { equals: term, mode: 'insensitive' } },
      select: { id: true, name: true, aliases: true },
    });
    const skill = (existing ??
      (await prisma.skill.create({
        data: {
          name: term,
          category: guessSkillCategory(term),
          aliases: [term.toLowerCase()],
        },
        select: { id: true, name: true, aliases: true },
      }))) as StoredSkill;
    this.skills.push(skill);
    this.byTerm.set(term, skill);
    return skill;
  }
}

/** Extracts lowercased, alphanumeric-only tokens that look like skills. */
function extractCandidateTerms(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .match(/[a-z][a-z0-9+#.-]{1,24}/g) ?? [];
  const stopWords = new Set([
    'full-time', 'part-time', 'remote', 'hybrid', 'onsite', 'salary', 'years', 'experience',
    'developer', 'engineer', 'senior', 'junior', 'lead', 'team', 'work', 'english', 'german',
    'required', 'responsibilities', 'requirements', 'about', 'the', 'and', 'with', 'for', 'you',
    'will', 'our', 'your', 'have', 'what', 'skills', 'join', 'company', 'job', 'position', 'role',
  ]);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    const key = token.trim();
    if (key.length < 2 || key.length > 20 || stopWords.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}
export interface IngestResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  durationMs: number;
}

async function findOrCreateCompany(name: string | null): Promise<{ id: string } | null> {
  if (!name) return null;
  const normalizedName = normalizeCompanyName(name);
  const existing = await prisma.company.findFirst({
    where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { normalizedName }] },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.company.create({
    data: { name: name.trim(), normalizedName },
    select: { id: true },
  });
}

export async function ingestProvider(
  provider: IJobProvider,
  jobs: NormalizedJob[],
): Promise<IngestResult> {
  const started = Date.now();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  let source = await prisma.jobSource.findUnique({ where: { slug: provider.sourceSlug } });
  if (!source) {
    await ensureSources();
    source = await prisma.jobSource.findUniqueOrThrow({ where: { slug: provider.sourceSlug } });
  }

  // One skill vocabulary load + one company cache per ingestion run — without
  // these the loop below issues several DB queries per job (N+1 pattern).
  const skillLinker = new SkillLinker();
  const companyCache = new Map<string, { id: string } | null>();

  for (const job of jobs) {
    const cacheKey = job.companyName ? normalizeCompanyName(job.companyName) : '';
    if (!companyCache.has(cacheKey)) {
      companyCache.set(cacheKey, await findOrCreateCompany(job.companyName));
    }
    const company = companyCache.get(cacheKey)!;
    const fingerprint = createHash('sha256').update(jobFingerprint(job)).digest('hex');

    const existing = job.externalId
      ? await prisma.job.findUnique({
          where: { sourceId_externalId: { sourceId: source.id, externalId: job.externalId } },
        })
      : null;

    const jobText = [job.title, job.description, job.extraText, job.tags.join(', ')].filter(Boolean).join('\n');

    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: { postedAt: safeDate(job.postedAt) ?? existing.postedAt },
      });
      updated++;
      await skillLinker.link(existing.id, jobText);
      continue;
    }

    // Second dedupe pass: same source + identical content fingerprint.
    const byFingerprint = await prisma.job.findFirst({
      where: { sourceId: source.id, fingerprint },
      select: { id: true },
    });
    if (byFingerprint) {
      skipped++;
      continue;
    }

    try {
      const data: Prisma.JobUncheckedCreateInput = {
        sourceId: source.id,
        externalId: job.externalId,
        companyId: company?.id,
        title: job.title.slice(0, 200),
        description: job.description.slice(0, 15_000),
        location: job.location?.slice(0, 200) ?? null,
        workMode: job.workMode,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        url: job.url.slice(0, 1000),
        postedAt: safeDate(job.postedAt),
        fingerprint,
      };
      const stored = await prisma.job.create({ data });
      created++;
      await skillLinker.link(stored.id, jobText);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        skipped++;
      } else {
        throw error;
      }
    }
  }

  await prisma.jobSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  return {
    source: provider.sourceSlug,
    fetched: jobs.length,
    created,
    updated,
    skipped,
    durationMs: Date.now() - started,
  };
}

/** Creates/adopts a manual job (LinkedIn paste or direct entry). */
export async function ingestManualJob(input: {
  title: string;
  companyName: string | null;
  description: string;
  location: string | null;
  url: string | null;
  workMode: NormalizedJob['workMode'];
  employmentType: NormalizedJob['employmentType'];
}): Promise<{ id: string }> {
  await ensureSources();
  const source = await prisma.jobSource.findUniqueOrThrow({ where: { slug: 'manual' } });
  const company = await findOrCreateCompany(input.companyName);
  const fingerprint = createHash('sha256').update(jobFingerprint(input)).digest('hex');

  const existing = await prisma.job.findFirst({
    where: { sourceId: source.id, fingerprint },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }

  const job = await prisma.job.create({
    data: {
      sourceId: source.id,
      companyId: company?.id,
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 15_000),
      location: input.location?.slice(0, 200) ?? null,
      workMode: input.workMode,
      employmentType: input.employmentType,
      url: input.url?.slice(0, 1000) ?? 'mailto:dev@jobradar.local',
      fingerprint,
    },
    select: { id: true },
  });
  const skillLinker = new SkillLinker();
  await skillLinker.link(job.id, [input.title, input.description].join('\n'));
  return job;
}

export interface SyncSummary {
  ranAt: string;
  results: IngestResult[];
}

/**
 * Runs every active provider adapter and collects the results.
 * Each provider (fetch + ingest) is bounded by PROVIDER_TIMEOUT_MS and the
 * whole loop by SYNC_OVERALL_TIMEOUT_MS, so a hanging provider can never
 * stall POST /api/jobs/sync forever — it is recorded as a zero-result entry.
 */
export async function syncActiveSources(): Promise<SyncSummary> {
  const overallStart = Date.now();
  const deadline = overallStart + SYNC_OVERALL_TIMEOUT_MS;
  logger.info(
    `[jobs] sync started — ${SYNC_OVERALL_TIMEOUT_MS / 1000}s overall budget, ${PROVIDER_TIMEOUT_MS / 1000}s per provider`,
  );
  try {
    // Bootstrap source rows — guarded so a cold DB cannot abort the whole sync.
    await withTimeout(ensureSources(), 15_000, '[jobs] ensureSources');
  } catch (error) {
    logger.warn(
      `[jobs] ensureSources failed (${error instanceof Error ? error.message : error}) — continuing anyway`,
    );
  }
  const providers: IJobProvider[] = [
    // Web search runs first: it is the fastest provider (~2s) and the user's
    // primary "look it up on the web" discovery mode. Being last, it used to
    // starve whenever slower providers burned the overall time budget.
    new WebSearchProvider(),
    new RemotiveProvider(),
    new RemoteOkProvider(),
    new ArbeitnowProvider(),
    new JSearchProvider(),
    new AdzunaProvider(),
  ];

  const results: IngestResult[] = [];
  for (const provider of providers) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      logger.warn(`[jobs] sync budget exhausted — skipping ${provider.sourceSlug}`);
      results.push({
        source: provider.sourceSlug,
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        durationMs: 0,
      });
      continue;
    }
    const budget = Math.min(PROVIDER_TIMEOUT_MS, remaining);
    const started = Date.now();
    logger.info(`[jobs] syncing provider: ${provider.sourceSlug} (budget ${Math.round(budget / 1000)}s)`);
    try {
      // Fetch AND persist together inside one budget: a cold/sleeping database
      // must never let the provider (and the whole sync) hang forever.
      const result = await withTimeout(
        (async () => {
          const jobs = await provider.fetchJobs();
          logger.info(`[jobs] ${provider.sourceSlug}: fetched ${jobs.length} jobs — ingesting`);
          return withDbRetry(() => ingestProvider(provider, jobs));
        })(),
        budget,
        `[jobs] ${provider.sourceSlug} fetch+ingest`,
      );
      results.push(result);
      logger.info(
        `[jobs] ${provider.sourceSlug}: done — ${result.created} created, ${result.updated} updated, ${result.skipped} skipped in ${result.durationMs}ms`,
      );
    } catch (error) {
      logger.warn(
        `[jobs] ${provider.sourceSlug} sync failed after ${Date.now() - started}ms: ${error instanceof Error ? error.message : error}`,
      );
      results.push({
        source: provider.sourceSlug,
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        durationMs: Date.now() - started,
      });
    }
  }
  const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
  logger.info(
    `[jobs] sync complete — ${totalCreated} new jobs across ${results.length} sources in ${Date.now() - overallStart}ms`,
  );
  return { ranAt: new Date().toISOString(), results };
}

export async function listActiveSources(): Promise<
  Array<{ slug: string; name: string; isActive: boolean; lastSyncedAt: string | null }>
> {
  await ensureSources();
  const sources = await prisma.jobSource.findMany({ orderBy: { slug: 'asc' } });
  return sources.map((source) => ({
    slug: source.slug,
    name: source.name,
    isActive: source.isActive,
    lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
  }));
}