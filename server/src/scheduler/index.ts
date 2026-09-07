import cron from 'node-cron';
import { logger } from '../config/logger';
import { syncActiveSources } from '../services/jobs/ingest.service';

let isRunning = false;

/**
 * Runs the job sync on a fixed schedule. node-cron keeps the timer in-process;
 * the guard flag prevents overlapping runs if a sync takes longer than the
 * interval.
 */
export function startJobScheduler(): void {
  // Every 6 hours — matches the plan's ingestion cadence.
  const schedule = process.env.JOBS_CRON_SCHEDULE ?? '0 */6 * * *';
  cron.schedule(schedule, async () => {
    if (isRunning) {
      logger.warn('[scheduler] previous job sync still running — skipping this tick');
      return;
    }
    isRunning = true;
    try {
      const summary = await syncActiveSources();
      const totalCreated = summary.results.reduce((sum, r) => sum + r.created, 0);
      logger.info(`[scheduler] job sync complete — ${totalCreated} new jobs across ${summary.results.length} sources`);
    } catch (error) {
      logger.error('[scheduler] job sync failed', error instanceof Error ? error.message : error);
    } finally {
      isRunning = false;
    }
  });
  logger.info(`[scheduler] job sync scheduled (${schedule})`);
}