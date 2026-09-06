import type { Preference, UserProfile } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type { UpdatePreferencesInput, UpdateProfileInput } from './profile.schemas';

function normalizeText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export interface CompletionResult {
  /** 0–100, rounded. */
  percent: number;
  /** Human-readable labels of the items still missing. */
  missing: string[];
}

/**
 * Transparent profile-completion score. Every item counts equally; the list
 * below IS the scoring documentation (used by the dashboard progress bar).
 */
export function computeCompletion(
  profile: UserProfile | null,
  preferences: Preference | null,
): CompletionResult {
  const checks: Array<{ label: string; done: boolean }> = [
    { label: 'Current title', done: Boolean(profile?.currentTitle) },
    { label: 'Headline', done: Boolean(profile?.headline) },
    { label: 'Summary', done: Boolean(profile?.summary) },
    { label: 'Location', done: Boolean(profile?.location) },
    { label: 'Phone number', done: Boolean(profile?.phone) },
    { label: 'LinkedIn profile', done: Boolean(profile?.linkedinUrl) },
    { label: 'GitHub profile', done: Boolean(profile?.githubUrl) },
    { label: 'Portfolio', done: Boolean(profile?.portfolioUrl) },
    {
      label: 'Years of experience',
      done: profile?.yearsOfExperience != null,
    },
    {
      label: 'Desired job titles',
      done: (preferences?.desiredTitles?.length ?? 0) > 0,
    },
    {
      label: 'Preferred work mode',
      done:
        preferences?.workMode != null && preferences.workMode !== 'UNKNOWN',
    },
    {
      label: 'Salary expectations',
      done: preferences?.salaryMin != null || preferences?.salaryMax != null,
    },
  ];

  const done = checks.filter((check) => check.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((check) => !check.done).map((check) => check.label),
  };
}

export async function getProfileBundle(userId: string): Promise<{
  profile: UserProfile | null;
  preferences: Preference | null;
  completion: CompletionResult;
}> {
  const [profile, preferences] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.preference.findUnique({ where: { userId } }),
  ]);

  return {
    profile,
    preferences,
    completion: computeCompletion(profile, preferences),
  };
}

export async function upsertProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const data = {
    headline: normalizeText(input.headline),
    summary: normalizeText(input.summary),
    location: normalizeText(input.location),
    phone: normalizeText(input.phone),
    linkedinUrl: normalizeText(input.linkedinUrl),
    githubUrl: normalizeText(input.githubUrl),
    portfolioUrl: normalizeText(input.portfolioUrl),
    yearsOfExperience: input.yearsOfExperience ?? null,
    currentTitle: normalizeText(input.currentTitle),
  };

  return prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function upsertPreferences(
  userId: string,
  input: UpdatePreferencesInput,
): Promise<Preference> {
  const data = {
    desiredTitles: input.desiredTitles,
    preferredLocations: input.preferredLocations,
    preferredTechnologies: input.preferredTechnologies,
    workMode: input.workMode,
    experienceLevel: input.experienceLevel,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    salaryCurrency: normalizeText(input.salaryCurrency),
    remoteOnly: input.remoteOnly,
    emailNotifications: input.emailNotifications,
  };

  return prisma.preference.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
