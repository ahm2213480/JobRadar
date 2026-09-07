import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { guessSkillCategory } from './IJobProvider';
import { clean, jobFingerprint } from './normalize';
import { ArbeitnowProvider } from './arbeitnow.adapter';
import { RemoteOkProvider } from './remoteok.adapter';
import { RemotiveProvider } from './remotive.adapter';

/** Time between two manual "Sync now" triggers, to protect external APIs. */
export const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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
    case 'manual':
      return { name: 'Manual / LinkedIn paste', baseUrl: null };
    default:
      return { name: slug, baseUrl: null };
  }
}

/** Idempotently creates the known sources so seed data exists on first boot. */
export async function ensureSources(): Promise<void> {
  for (const slug of ['remotive', 'remoteok', 'arbeitnow', 'manual']) {
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
 * Loads all known skills once per ingestion and links a job to every skill
 * whose canonical name or one of its aliases appears in the job text.
 * Unknown technical tags are promoted to new Skill rows so the vocabulary
 * grows with the data instead of remaining static.
 */
async function linkJobSkills(jobId: string, text: string): Promise<void> {
  const lowerText = text.toLowerCase();
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true, aliases: true },
  }) as StoredSkill[];

  const matchedSkillIds = new Set<string>();
  for (const skill of skills) {
    const terms = [skill.name, ...skill.aliases].map((term) => term.trim().toLowerCase()).filter(Boolean);
    if (terms.some((term) => lowerText.includes(term))) {
      matchedSkillIds.add(skill.id);
    }
  }

  // Promote tags that look like technologies but aren't known skills yet.
  const existingNames = new Set(skills.map((skill) => skill.name.toLowerCase()));
  for (const term of extractCandidateTerms(text).slice(0, 30)) {
    if (matchedSkillIds.size >= 50) break;
    if (existingNames.has(term)) continue;
    let skillRow = await prisma.skill.findFirst({
      where: { name: { equals: term, mode: 'insensitive' } },
      select: { id: true, aliases: true },
    });
    if (!skillRow) {
      skillRow = await prisma.skill.create({
        data: {
          name: term,
          category: guessSkillCategory(term),
          aliases: [term.toLowerCase()],
        },
        select: { id: true, aliases: true },
      });
      existingNames.add(term.toLowerCase());
    }
    matchedSkillIds.add(skillRow.id);
  }

  if (matchedSkillIds.size === 0) return;

  // Upsert the job→skill links in one cheap transaction per job.
  await prisma.$transaction(
    [...matchedSkillIds].map((skillId) =>
      prisma.jobSkill.upsert({
        where: { jobId_skillId: { jobId, skillId } },
        update: {},
        create: { jobId, skillId, isRequired: true },
      }),
    ),
  );
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

  for (const job of jobs) {
    const company = await findOrCreateCompany(job.companyName);
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
        data: { postedAt: job.postedAt ?? existing.postedAt },
      });
      updated++;
      await linkJobSkills(existing.id, jobText);
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
        postedAt: job.postedAt,
        fingerprint,
      };
      const stored = await prisma.job.create({ data });
      created++;
      await linkJobSkills(stored.id, jobText);
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
  await linkJobSkills(job.id, [input.title, input.description].join('\n'));
  return job;
}

export interface SyncSummary {
  ranAt: string;
  results: IngestResult[];
}

/** Runs every active provider adapter and collects the results. */
export async function syncActiveSources(): Promise<SyncSummary> {
  await ensureSources();
  const providers: IJobProvider[] = [
    new RemotiveProvider(),
    new RemoteOkProvider(),
    new ArbeitnowProvider(),
  ];

  const results: IngestResult[] = [];
  for (const provider of providers) {
    try {
      const jobs = await provider.fetchJobs();
      const result = await ingestProvider(provider, jobs);
      results.push(result);
      logger.info(
        `[jobs] ${provider.sourceSlug}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped in ${result.durationMs}ms`,
      );
    } catch (error) {
      logger.warn(
        `[jobs] ${provider.sourceSlug} sync failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
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