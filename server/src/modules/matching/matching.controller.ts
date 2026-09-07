import type { Request, Response } from 'express';
import { matchingService } from '../../services/matching/matching.service';
import { matchQuerySchema } from './matching.schemas';
import type { MatchQuery } from './matching.schemas';

export async function getMatches(req: Request, res: Response): Promise<void> {
  const query = matchQuerySchema.parse(req.query) as MatchQuery;
  const results = await matchingService.matchAllJobsForUser(
    req.user!.id,
    query.limit,
  );
  res.status(200).json({ matches: results, total: results.length });
}

export async function getMatchForJob(req: Request, res: Response): Promise<void> {
  const result = await matchingService.matchJobForUser(
    req.user!.id,
    String(req.params.jobId),
  );
  res.status(200).json(result);
}