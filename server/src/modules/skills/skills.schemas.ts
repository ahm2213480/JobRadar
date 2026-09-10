// Phase 9 — Skills gap + learning goals validation schemas.
// All operations are scoped to the authenticated userId.
import { z } from 'zod';

export const createLearningGoalSchema = z.object({
  skillId: z.string().trim().min(1, 'Skill is required').max(100),
  dueDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO-8601 date')
    .optional(),
});

export type CreateLearningGoalInput = z.infer<typeof createLearningGoalSchema>;

export const updateLearningGoalSchema = z
  .object({
    status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
    dueDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO-8601 date')
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export type UpdateLearningGoalInput = z.infer<typeof updateLearningGoalSchema>;

export const learningGoalIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Learning goal ID is required').max(100),
});

export const optimizeCvSchema = z.object({
  jobId: z.string().trim().min(1, 'Job ID is required').max(100),
});

export type OptimizeCvInput = z.infer<typeof optimizeCvSchema>;