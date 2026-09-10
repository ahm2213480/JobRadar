// Phase 8, Step 2 — Applications validation schemas.
// Every operation is scoped to the authenticated userId; the application id
// comes from the URL path and is validated here.
import { z } from 'zod';

export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'HR_SCREENING',
  'TECHNICAL_INTERVIEW',
  'FINAL_INTERVIEW',
  'OFFER',
  'REJECTED',
] as const;

// Mirrors the Prisma ApplicationStatus enum exactly — never add custom values.
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);

export const applicationIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Application ID is required').max(100),
});

const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO-8601 date');

/** Optional http(s) URL — '' is allowed so clients can clear the field. */
const urlString = (allowEmpty: boolean) =>
  z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => {
        if (allowEmpty && value === '') return true;
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      'Enter a valid http(s) URL',
    );

export const createApplicationSchema = z
  .object({
    // Either an existing JobRadar job…
    jobId: z.string().trim().min(1, 'Job ID is required').max(100).optional(),
    // …or a manual application. Manual apps resolve a company by name into
    // Company.companyId (the schema has no companyName column).
    title: z.string().trim().min(1, 'Job title is required').max(200).optional(),
    companyName: z.string().trim().min(1, 'Company name is required').max(200).optional(),
    url: urlString(false).optional(),
    status: applicationStatusSchema.optional(),
    appliedAt: isoDateString.optional(),
    salaryText: z.string().trim().max(200).optional(),
    contactName: z.string().trim().max(100).optional(),
    contactEmail: z.string().trim().email('Enter a valid email address').max(200).optional(),
    cvId: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.jobId && !data.title) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide a jobId for an existing job, or a title for a manual application',
        path: ['title'],
      });
    }
  });

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

// All fields optional so any combination can be PATCHed; `.nullable()` lets the
// client explicitly clear a value (e.g. remove a contact email).
export const updateApplicationSchema = z
  .object({
    title: z.string().trim().min(1, 'Job title is required').max(200).optional(),
    url: urlString(true).nullable().optional(),
    status: applicationStatusSchema.optional(),
    appliedAt: isoDateString.nullable().optional(),
    salaryText: z.string().trim().max(200).nullable().optional(),
    contactName: z.string().trim().max(100).nullable().optional(),
    contactEmail: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .max(200)
      .nullable()
      .optional(),
    cvId: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const updateApplicationStatusSchema = z.object({
  status: applicationStatusSchema,
});

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;