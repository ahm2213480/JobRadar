import { EmploymentType, WorkMode } from '@prisma/client';
import { z } from 'zod';

export const listJobsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  workMode: z.nativeEnum(WorkMode).optional(),
  location: z.string().trim().max(100).optional(),
  source: z.string().trim().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
}).default({});

export const createManualJobSchema = z.object({
  title: z.string().trim().min(1, 'Job title is required').max(200),
  companyName: z.string().trim().max(200).optional(),
  description: z.string().trim().min(50, 'Description must be at least 50 characters').max(15_000),
  location: z.string().trim().max(200).optional(),
  url: z.string().trim().url().optional().or(z.literal('')),
  workMode: z.nativeEnum(WorkMode).default('UNKNOWN'),
  employmentType: z.nativeEnum(EmploymentType).default('UNKNOWN'),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type CreateManualJobInput = z.infer<typeof createManualJobSchema>;