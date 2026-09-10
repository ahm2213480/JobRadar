import type { Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import type { JobListItem } from '../jobs/jobs.service';

// Reuse the same shape/include as the jobs module so saved cards render
// identically to jobs-list cards.
const jobInclude = {
  company: { select: { id: true, name: true } },
  source: { select: { slug: true, name: true } },
  jobSkills: {
    select: { isRequired: true, skill: { select: { id: true, name: true } } },
    take: 15,
  },
} satisfies Prisma.JobInclude & Record<string, unknown>;

function toListItem(row: {
  id: string;
  title: string;
  description: string;
  location: string | null;
  workMode: string;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  url: string;
  postedAt: Date | null;
  company: { id: string; name: string } | null;
  source: { slug: string; name: string };
  jobSkills: Array<{ isRequired: boolean; skill: { id: string; name: string } }>;
}): JobListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    workMode: row.workMode,
    employmentType: row.employmentType,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    url: row.url,
    postedAt: row.postedAt?.toISOString() ?? null,
    company: row.company,
    source: row.source,
    skills: row.jobSkills.map((entry) => ({
      id: entry.skill.id,
      name: entry.skill.name,
      isRequired: entry.isRequired,
    })),
  };
}

export interface SavedJobListItem extends JobListItem {
  savedAt: string;
}

/**
 * All queries are scoped by userId — never trust a client-provided user id.
 */
export async function saveJob(userId: string, jobId: string): Promise<{ saved: boolean }> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  try {
    await prisma.savedJob.create({
      data: { userId, jobId, status: 'SAVED' },
    });
  } catch (error) {
    // P2002 = @@unique([userId, jobId]) violation → already saved.
    if (error instanceof PrismaNS.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Job is already saved');
    }
    throw error;
  }
  return { saved: true };
}

export async function unsaveJob(userId: string, jobId: string): Promise<void> {
  // deleteMany with the composite unique key guarantees ownership scoping —
  // a user can only delete their own (userId, jobId) row.
  const result = await prisma.savedJob.deleteMany({
    where: { userId, jobId },
  });
  if (result.count === 0) {
    throw new AppError(404, 'Saved job not found');
  }
}

export async function isJobSaved(userId: string, jobId: string): Promise<{ saved: boolean }> {
  const row = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });
  return { saved: row !== null };
}

export async function listSavedJobs(userId: string): Promise<SavedJobListItem[]> {
  const rows = await prisma.savedJob.findMany({
    where: { userId },
    include: { job: { include: jobInclude } },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((entry) => ({
    ...toListItem(entry.job),
    savedAt: entry.createdAt.toISOString(),
  }));
}
