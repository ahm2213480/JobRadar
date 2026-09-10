import type { ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import type { JobListItem } from '../jobs/jobs.service';
import type { CreateApplicationInput, UpdateApplicationInput } from './applications.schemas';

// Same job include used by the jobs/saved modules so embedded cards render
// identically everywhere.
const jobInclude = {
  company: { select: { id: true, name: true } },
  source: { select: { slug: true, name: true } },
  jobSkills: {
    select: { isRequired: true, skill: { select: { id: true, name: true } } },
    take: 15,
  },
} satisfies Prisma.JobInclude & Record<string, unknown>;

const applicationInclude = {
  job: { include: jobInclude },
  company: { select: { id: true, name: true } },
} satisfies Prisma.ApplicationInclude & Record<string, unknown>;

export interface ApplicationListItem {
  id: string;
  jobId: string | null;
  companyId: string | null;
  title: string;
  url: string | null;
  status: ApplicationStatus;
  appliedAt: string | null;
  interviewDate: string | null;
  salaryText: string | null;
  contactName: string | null;
  contactEmail: string | null;
  cvId: string | null;
  matchScoreSnapshot: number | null;
  createdAt: string;
  updatedAt: string;
  job: JobListItem | null;
  company: { id: string; name: string } | null;
}

function toJobListItem(row: {
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

function toListItem(row: {
  id: string;
  jobId: string | null;
  companyId: string | null;
  title: string;
  url: string | null;
  status: ApplicationStatus;
  appliedAt: Date | null;
  interviewDate: Date | null;
  salaryText: string | null;
  contactName: string | null;
  contactEmail: string | null;
  cvId: string | null;
  matchScoreSnapshot: number | null;
  createdAt: Date;
  updatedAt: Date;
  job: Parameters<typeof toJobListItem>[0] | null;
  company: { id: string; name: string } | null;
}): ApplicationListItem {
  return {
    id: row.id,
    jobId: row.jobId,
    companyId: row.companyId,
    title: row.title,
    url: row.url,
    status: row.status,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    interviewDate: row.interviewDate?.toISOString() ?? null,
    salaryText: row.salaryText,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    cvId: row.cvId,
    matchScoreSnapshot: row.matchScoreSnapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    job: row.job ? toJobListItem(row.job) : null,
    company: row.company,
  };
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

/**
 * All queries are scoped by the authenticated userId — never trust a
 * client-provided user id.
 */
export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
): Promise<ApplicationListItem> {
  const jobId: string | null = input.jobId ?? null;
  let title = input.title?.trim() ?? '';
  let url: string | null = input.url ?? null;
  let companyId: string | null = null;
  // Historical snapshot — reuse already-stored match data if present. We never
  // recompute or invoke the matching/AI logic here (mandatory: no algorithm
  // changes), and the column stays null when no snapshot exists yet.
  let matchScoreSnapshot: number | null = null;

  if (jobId) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, url: true, companyId: true },
    });
    if (!job) {
      throw new AppError(404, 'Job not found');
    }
    if (!title) title = job.title;
    if (!url) url = job.url || null;
    if (job.companyId) companyId = job.companyId;

    const stored = await prisma.jobMatch.findUnique({
      where: { userId_jobId: { userId, jobId: job.id } },
      select: { matchScore: true },
    });
    matchScoreSnapshot = stored?.matchScore ?? null;
  }

  if (!title) {
    throw new AppError(400, 'A title is required for manual applications');
  }

  // Manual applications: find-or-create the company by normalized name and
  // link through the real Company.companyId FK.
  if (input.companyName) {
    const normalizedName = normalizeCompanyName(input.companyName);
    const company = await prisma.company.upsert({
      where: { normalizedName },
      update: {},
      create: { name: input.companyName.trim(), normalizedName },
      select: { id: true },
    });
    companyId = company.id;
  }

  if (input.cvId) {
    const cv = await prisma.cV.findFirst({
      where: { id: input.cvId, userId },
      select: { id: true },
    });
    if (!cv) {
      throw new AppError(400, 'CV not found');
    }
  }

  const row = await prisma.application.create({
    data: {
      userId,
      jobId,
      companyId,
      title,
      url,
      status: input.status ?? 'SAVED',
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
      salaryText: input.salaryText ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      cvId: input.cvId ?? null,
      matchScoreSnapshot,
    },
    include: applicationInclude,
  });
  return toListItem(row);
}

export async function listApplications(
  userId: string,
): Promise<{ applications: ApplicationListItem[]; total: number }> {
  const rows = await prisma.application.findMany({
    where: { userId },
    include: applicationInclude,
    orderBy: { updatedAt: 'desc' },
  });
  return { applications: rows.map(toListItem), total: rows.length };
}

export async function getApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationListItem> {
  const row = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: applicationInclude,
  });
  if (!row) {
    throw new AppError(404, 'Application not found');
  }
  return toListItem(row);
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  input: UpdateApplicationInput,
): Promise<ApplicationListItem> {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Application not found');
  }

  if (input.cvId) {
    const cv = await prisma.cV.findFirst({
      where: { id: input.cvId, userId },
      select: { id: true },
    });
    if (!cv) {
      throw new AppError(400, 'CV not found');
    }
  }

  // Unchecked input so the scalar `cvId` FK is settable directly (the checked
  // input only exposes the relation form).
  const data: Prisma.ApplicationUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.url !== undefined) data.url = input.url === '' ? null : input.url;
  if (input.status !== undefined) data.status = input.status;
  if (input.appliedAt !== undefined) {
    data.appliedAt = input.appliedAt === null ? null : new Date(input.appliedAt);
  }
  if (input.salaryText !== undefined) data.salaryText = input.salaryText;
  if (input.contactName !== undefined) data.contactName = input.contactName;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
  if (input.cvId !== undefined) data.cvId = input.cvId;

  const row = await prisma.application.update({
    where: { id: applicationId },
    data,
    include: applicationInclude,
  });
  return toListItem(row);
}

export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
): Promise<ApplicationListItem> {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Application not found');
  }

  const row = await prisma.application.update({
    where: { id: applicationId },
    data: { status },
    include: applicationInclude,
  });
  return toListItem(row);
}

export async function deleteApplication(userId: string, applicationId: string): Promise<void> {
  const result = await prisma.application.deleteMany({
    where: { id: applicationId, userId },
  });
  if (result.count === 0) {
    throw new AppError(404, 'Application not found');
  }
}