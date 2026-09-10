// Saved Jobs (Phase 8, Step 1) — validation schemas.
// All SavedJob operations are scoped by the authenticated userId; the jobId
// comes from the URL path and is validated here as a non-empty string.
import { z } from 'zod';

export const savedJobIdParamSchema = z.object({
  jobId: z.string().trim().min(1, 'Job ID is required').max(100),
});

export type SavedJobIdParam = z.infer<typeof savedJobIdParamSchema>;
