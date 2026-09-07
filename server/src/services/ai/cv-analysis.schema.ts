import { SkillCategory } from '@prisma/client';
import { z } from 'zod';

/**
 * Structured output of the CV analysis. Every AI adapter must return data
 * matching this schema — the AI is never allowed to "invent" the shape, and
 * any malformed response is rejected before reaching the database.
 */
const extractedSkillSchema = z.object({
  name: z.string().trim().min(1).max(120, 'Skill name too long'),
  category: z.nativeEnum(SkillCategory),
  /** Optional self-assessment 1–5 (the AI infers it from context). */
  proficiency: z.number().int().min(1).max(5).nullable().optional(),
  /** Optional years of experience with this skill. */
  years: z.number().min(0).max(50).nullable().optional(),
});

const profileSchema = z.object({
  headline: z.string().trim().max(120).nullable(),
  currentTitle: z.string().trim().max(120).nullable(),
  summary: z.string().trim().max(2000).nullable(),
  location: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(30).nullable(),
  linkedinUrl: z.string().trim().url().nullable(),
  githubUrl: z.string().trim().url().nullable(),
  portfolioUrl: z.string().trim().url().nullable(),
  yearsOfExperience: z.number().min(0).max(50).nullable(),
});

export const cvAnalysisSchema = z.object({
  profile: profileSchema,
  skills: z.array(extractedSkillSchema).max(100, 'Too many skills extracted'),
});

export type CvAnalysis = z.infer<typeof cvAnalysisSchema>;
export type ExtractedSkill = z.infer<typeof extractedSkillSchema>;