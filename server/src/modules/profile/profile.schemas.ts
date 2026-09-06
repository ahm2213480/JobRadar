import { ExperienceLevel, WorkMode } from '@prisma/client';
import { z } from 'zod';

// Empty strings are accepted and normalized to null by the service, so the
// client can simply send its form state.
const optionalTrimmed = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`).optional();

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .url(`${label} must be a valid URL (e.g. https://linkedin.com/in/you)`)
    .or(z.literal(''))
    .optional();

export const updateProfileSchema = z.object({
  headline: optionalTrimmed(120, 'Headline'),
  summary: optionalTrimmed(2000, 'Summary'),
  location: optionalTrimmed(120, 'Location'),
  phone: optionalTrimmed(30, 'Phone number'),
  linkedinUrl: optionalUrl('LinkedIn URL'),
  githubUrl: optionalUrl('GitHub URL'),
  portfolioUrl: optionalUrl('Portfolio URL'),
  yearsOfExperience: z.number().int().min(0).max(50).nullable().optional(),
  currentTitle: optionalTrimmed(120, 'Current title'),
});

const itemList = (max: number) =>
  z
    .array(z.string().trim().min(1).max(120))
    .max(max, `At most ${max} items are allowed`);

export const updatePreferencesSchema = z
  .object({
    desiredTitles: itemList(10).optional(),
    preferredLocations: itemList(10).optional(),
    preferredTechnologies: itemList(20).optional(),
    workMode: z.nativeEnum(WorkMode).optional(),
    experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
    salaryMin: z.number().int().min(0).max(10_000_000).nullable().optional(),
    salaryMax: z.number().int().min(0).max(10_000_000).nullable().optional(),
    salaryCurrency: z.string().trim().length(3, 'Currency must be a 3-letter code').nullable().optional(),
    remoteOnly: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMin <= data.salaryMax,
    {
      message: 'Minimum salary cannot be greater than maximum salary',
      path: ['salaryMin'],
    },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
