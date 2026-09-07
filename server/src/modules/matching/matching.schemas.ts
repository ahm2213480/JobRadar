import { z } from 'zod';

export const matchQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .default({});

export type MatchQuery = z.infer<typeof matchQuerySchema>;