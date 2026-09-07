import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type { ListJobsQuery } from './jobs.schemas';

const jobInclude = {
  company: { select: { id: true, name: true } },
  source: { select: { slug: true, name: true } },
  jobSkills: {
    select: { isRequired: true, skill: { select: { id: true, name: true } } },
    take: 15,
  },
} satisfies Prisma.JobInclude & Record<string, unknown>;

export interface JobListItem {
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
  postedAt: string | null;
  company: { id: string; name: string } | null;
  source: { slug: string; name: string };
  skills: Array<{ id: string; name: string; isRequired: boolean }>;
}

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

export async function listJobs(query: ListJobsQuery): Promise<{
  jobs: JobListItem[];
  total: number;
}> {
  const where: Prisma.JobWhereInput = {};
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  if (query.workMode) {
    where.workMode = query.workMode;
  }
  if (query.location) {
    where.location = { contains: query.location, mode: 'insensitive' };
  }
  if (query.source) {
    where.source = { slug: query.source };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      include: jobInclude,
      orderBy: { postedAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs: rows.map(toListItem), total };
}

export async function getJob(jobId: string): Promise<JobListItem> {
  const row = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: jobInclude,
  });
  return toListItem(row);
}

export async function getJobStats(): Promise<{
  totalJobs: number;
  totalCompanies: number;
  sources: Array<{ slug: string; name: string; jobCount: number; lastSyncedAt: string | null }>;
}> {
  const sources = await prisma.jobSource.findMany();
  const rows = await prisma.job.groupBy({
    by: ['sourceId'],
    _count: { _all: true },
  });
  const counts = new Map(rows.map((row) => [row.sourceId, row._count._all]));

  return {
    totalJobs: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
    totalCompanies: await prisma.company.count(),
    sources: sources.map((source) => ({
      slug: source.slug,
      name: source.name,
      jobCount: counts.get(source.id) ?? 0,
      lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
    })),
  };
}