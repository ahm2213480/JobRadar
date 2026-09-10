import { randomUUID } from 'node:crypto';
import type { Prisma, MatchRecommendation } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { aiService } from '../ai';
import { scoreJob, scoreAllJobs } from './algorithm';
import type { IMatchingService, MatchJobInput, MatchResult, MatchUserProfile } from './types';

/**
 * Loads the user's full profile (profile + preferences + skills) and maps it
 * to the algorithm's input shape. Returns null when the user has no data to
 * match against.
 */
async function loadUserProfile(userId: string): Promise<MatchUserProfile | null> {
  const [profile, preference, userSkills] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.preference.findUnique({ where: { userId } }),
    prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
  ]);
  if (!preference && !profile) return null;
  return {
    currentTitle: profile?.currentTitle ?? null,
    yearsOfExperience: profile?.yearsOfExperience ?? null,
    location: profile?.location ?? null,
    desiredTitles: preference?.desiredTitles ?? [],
    preferredLocations: preference?.preferredLocations ?? [],
    preferredTechnologies: preference?.preferredTechnologies ?? [],
    workMode: preference?.workMode ?? 'UNKNOWN',
    experienceLevel: preference?.experienceLevel ?? 'UNKNOWN',
    salaryMin: preference?.salaryMin ?? null,
    salaryMax: preference?.salaryMax ?? null,
    salaryCurrency: preference?.salaryCurrency ?? null,
    remoteOnly: preference?.remoteOnly ?? false,
    skills: userSkills.map((us) => ({ name: us.skill.name, aliases: us.skill.aliases })),
  };
}

/** Maps a Job + its skills to the algorithm's input shape. */
function mapJobToInput(job: {
  id: string;
  title: string;
  location: string | null;
  workMode: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  jobSkills: Array<{ isRequired: boolean; skill: { name: string } }>;
}): MatchJobInput {
  return {
    id: job.id,
    title: job.title,
    location: job.location,
    workMode: job.workMode as MatchJobInput['workMode'],
    experienceLevel: job.experienceLevel as MatchJobInput['experienceLevel'],
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    skills: job.jobSkills.map((js) => ({ name: js.skill.name, isRequired: js.isRequired })),
  };
}

/** Strips runtime-only fields so factors are JSON-safe for Prisma. */
function serializeBreakdown(
  result: Omit<MatchResult, 'aiExplanation' | 'aiUsed' | 'computedAt'>,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(result.factors));
}

function buildMatchingPrompt(
  job: MatchJobInput,
  result: Omit<MatchResult, 'aiExplanation' | 'aiUsed'>,
  _user: MatchUserProfile,
): string {
  const strengths = [...result.matchedRequiredSkills, ...result.matchedPreferredSkills];
  const missing = result.missingRequiredSkills;
  return [
    'You are a helpful career coach writing a concise match explanation.',
    '',
    `Job: ${job.title}`,
    `Match score: ${result.score}/100`,
    '',
    'Factor breakdown:',
    ...result.factors.map(
      (f) =>
        `${f.label}: ${Math.round(f.score * 100)}% -> ${Math.round(f.weightedScore * 100)} pts, ${f.explanation ?? ''}`,
    ),
    '',
    `Matched skills (${strengths.length > 0 ? strengths.join(', ') : 'none'}).`,
    `Missing required skills (${missing.length > 0 ? missing.join(', ') : 'none'}).`,
    '',
    'Write a concise "Why you match" explanation (2-3 short sentences max). Highlight strengths, note missing skills, and give a brief recommendation.',
    'Respond in plain text only - no JSON, no markdown headings.',
  ].join('\n');
}

async function generateAiExplanation(
  job: MatchJobInput,
  result: Omit<MatchResult, 'aiExplanation' | 'aiUsed'>,
  user: MatchUserProfile,
): Promise<string | null> {
  try {
    return await aiService.explainMatch(buildMatchingPrompt(job, result, user));
  } catch (error) {
    logger.warn('AI match explanation failed - returning score-only result', {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

function toRecommendation(score: number): MatchRecommendation {
  if (score >= 80) return 'HIGHLY_RECOMMENDED';
  if (score >= 60) return 'RECOMMENDED';
  return 'CONSIDER';
}

export const matchingService: IMatchingService = {
    calculateScore(job: MatchJobInput, user: MatchUserProfile): MatchResult {
    const base = scoreJob(job, user);
    return { ...base, aiExplanation: null, aiUsed: false, computedAt: new Date().toISOString() };
  },

  score(job: MatchJobInput, user: MatchUserProfile): MatchResult {
    return this.calculateScore(job, user);
  },

  scoreAll(jobs: MatchJobInput[], user: MatchUserProfile): MatchResult[] {
    return scoreAllJobs(jobs, user).map((base) => ({
      ...base,
      aiExplanation: null,
      aiUsed: false,
      computedAt: new Date().toISOString(),
    }));
  },

  async matchJobForUser(userId: string, jobId: string): Promise<MatchResult> {
    const user = await loadUserProfile(userId);
    if (!user) throw new Error('No profile or preferences found - please complete your profile first.');

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true, jobSkills: { include: { skill: true } } },
    });
    if (!job) throw new Error('Job not found.');

    const jobInput = mapJobToInput(job);
    const base = scoreJob(jobInput, user);
    const aiExplanation = await generateAiExplanation(jobInput, base, user);

    await prisma.jobMatch.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: {
        matchScore: base.score,
        breakdown: serializeBreakdown(base),
        aiExplanation,
        recommendation: toRecommendation(base.score),
        aiModel: aiExplanation ? aiService.name : null,
        computedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        userId,
        jobId,
        matchScore: base.score,
        breakdown: serializeBreakdown(base),
        aiExplanation,
        recommendation: toRecommendation(base.score),
        aiModel: aiExplanation ? aiService.name : null,
        computedAt: new Date(),
      },
    });

    return {
      ...base,
      title: job.title,
      company: job.company?.name ?? null,
      workMode: job.workMode as MatchResult['workMode'],
      location: job.location,
      aiExplanation,
      aiUsed: Boolean(aiExplanation),
      computedAt: new Date().toISOString(),
    };
  },

  async matchAllJobsForUser(userId: string, limit = 100): Promise<MatchResult[]> {
    const user = await loadUserProfile(userId);
    if (!user) return [];

    const jobs = await prisma.job.findMany({
      include: { company: true, jobSkills: { include: { skill: true } } },
      take: 500,
    });
    const jobInputs = jobs.map(mapJobToInput);
    const scored = scoreAllJobs(jobInputs, user).slice(0, limit);

    await prisma.$transaction(
      scored.map((result) => {
        const job = jobInputs.find((j) => j.id === result.jobId)!;
        return prisma.jobMatch.upsert({
          where: { userId_jobId: { userId, jobId: job.id } },
          update: {
            matchScore: result.score,
            breakdown: serializeBreakdown(result),
            recommendation: toRecommendation(result.score),
            computedAt: new Date(),
          },
          create: {
            id: randomUUID(),
            userId,
            jobId: job.id,
            matchScore: result.score,
            breakdown: serializeBreakdown(result),
            recommendation: toRecommendation(result.score),
          },
        });
      }),
    );

    const jobById = new Map(jobs.map((j) => [j.id, j]));
    return scored.map((base) => {
      const originalJob = jobById.get(base.jobId)!;
      return {
        ...base,
        company: originalJob.company?.name ?? null,
        aiExplanation: null,
        aiUsed: false,
        computedAt: new Date().toISOString(),
      };
    });
  },
};
