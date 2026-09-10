import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { aiService } from '../../services/ai';

/**
 * Phase 9 — CV Optimizer.
 *
 * Deterministic core: compares the skills extracted from the user's CV
 * (stored as user_skills with source CV/AI) against a specific job's required
 * and preferred skills. The AI is used ONLY to write suggestions based on
 * facts already present in the profile — never to invent skills, and never to
 * produce the numeric score. If the AI call fails the deterministic result is
 * still returned.
 */

export interface OptimizerResult {
  jobId: string;
  jobTitle: string;
  cvId: string;
  cvFileName: string;
  /** 0-100 — share of the job's required skills present in the CV. */
  cvMatchPct: number;
  matchedRequired: string[];
  matchedPreferred: string[];
  missingRequired: string[];
  missingPreferred: string[];
  /** AI-written suggestions grounded in the deterministic facts, or null. */
  suggestions: string[] | null;
  aiUsed: boolean;
}

function buildPrompt(
  jobTitle: string,
  matched: string[],
  missingRequired: string[],
  missingPreferred: string[],
): string {
  return [
    'You are a concise career coach helping a candidate tailor their CV.',
    'IMPORTANT: only reference skills and experience from the facts below. Never invent skills, projects or experience the candidate does not have.',
    '',
    `Job title: ${jobTitle}`,
    matched.length > 0 ? `Skills the candidate already has (do not suggest adding these): ${matched.join(', ')}` : 'No matching skills found.',
    missingRequired.length > 0 ? `Required skills missing from the CV: ${missingRequired.join(', ')}` : '',
    missingPreferred.length > 0 ? `Preferred skills missing from the CV: ${missingPreferred.join(', ')}` : '',
    '',
    'Write 2-4 short, actionable suggestions (one per line, no numbering) telling the candidate how to legitimately surface relevant experience they already have, or which missing required skills are worth learning first. If a required skill is missing, suggest learning it only if that is realistic; otherwise say to address it in a cover letter.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function optimizeCvForJob(
  userId: string,
  cvId: string,
  jobId: string,
): Promise<OptimizerResult> {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: { id: true, fileName: true },
  });
  if (!cv) {
    throw new AppError(404, 'CV not found');
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      jobSkills: {
        select: { isRequired: true, skill: { select: { name: true } } },
      },
    },
  });
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  // The user's skills originate from the CV parse (source CV or AI on CV text)
  // or manual additions — this is the truthful picture of what the CV shows.
  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: { select: { name: true, aliases: true } } },
  });

  const owned = new Set(
    userSkills.flatMap((us) => [us.skill.name.toLowerCase(), ...us.skill.aliases.map((a) => a.toLowerCase())]),
  );

  const required = job.jobSkills.filter((js) => js.isRequired);
  const preferred = job.jobSkills.filter((js) => !js.isRequired);
  const has = (name: string) => owned.has(name.toLowerCase());

  const matchedRequired = required.filter((js) => has(js.skill.name)).map((js) => js.skill.name);
  const matchedPreferred = preferred.filter((js) => has(js.skill.name)).map((js) => js.skill.name);
  const missingRequired = required.filter((js) => !has(js.skill.name)).map((js) => js.skill.name);
  const missingPreferred = preferred.filter((js) => !has(js.skill.name)).map((js) => js.skill.name);

  const cvMatchPct =
    required.length > 0
      ? Math.round((matchedRequired.length / required.length) * 100)
      : matchedPreferred.length > 0
        ? Math.round(
            ((matchedRequired.length + matchedPreferred.length) /
              (required.length + preferred.length)) *
              100,
          )
        : 100;

  // AI suggestions are optional — never block the deterministic result.
  let suggestions: string[] | null = null;
  let aiUsed = false;
  try {
    const text = await aiService.explainMatch(
      buildPrompt(job.title, [...matchedRequired, ...matchedPreferred], missingRequired, missingPreferred),
    );
    const lines = text
      .split('\n')
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 4);
    if (lines.length > 0) {
      suggestions = lines;
      aiUsed = true;
    }
  } catch {
    // Deterministic result is returned without suggestions.
  }

  return {
    jobId: job.id,
    jobTitle: job.title,
    cvId: cv.id,
    cvFileName: cv.fileName,
    cvMatchPct,
    matchedRequired,
    matchedPreferred,
    missingRequired,
    missingPreferred,
    suggestions,
    aiUsed,
  };
}