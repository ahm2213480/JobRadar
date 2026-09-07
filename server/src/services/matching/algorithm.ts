import {
  EXPERIENCE_ORDER,
  MATCH_WEIGHTS,
  scoreToRecommendation,
  type MatchFactorResult,
  type MatchJobInput,
  type MatchResult,
  type MatchUserProfile,
  type UserSkillInput,
} from './types';

/**
 * Pure, deterministic matching algorithm. No AI, no randomness, no DB access.
 * Given the same inputs it always produces the same output — which makes it
 * trivial to test and fully explainable to the user.
 *
 * Each factor returns a score in [0, 1]. The final score is
 *   round( Σ weight_i × score_i × 100 )
 * and is therefore also in [0, 100].
 */

/** Normalises a string for case-/punctuation-insensitive comparison. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Builds a set of searchable tokens (canonical name + aliases), lowercased. */
function skillTokens(skill: UserSkillInput): string[] {
  return [skill.name, ...skill.aliases]
    .map((s) => normalise(s))
    .filter(Boolean);
}

/**
 * Returns true when a user possesses a job skill — matched by canonical name
 * or any alias, case-insensitively.
 */
function userHasSkill(userSkills: UserSkillInput[], jobSkillName: string): boolean {
  const target = normalise(jobSkillName);
  if (!target) return false;
  for (const userSkill of userSkills) {
    const tokens = skillTokens(userSkill);
    if (tokens.includes(target)) return true;
    if (tokens.some((token) => target.includes(token) || token.includes(target))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Factor 1: Required skills (35%)
// ---------------------------------------------------------------------------
function scoreRequiredSkills(
  job: MatchJobInput,
  user: MatchUserProfile,
): MatchFactorResult {
  const required = job.skills.filter((s) => s.isRequired);
  const total = required.length;

  if (total === 0) {
    return {
      id: 'requiredSkills',
      label: 'Required skills',
      weight: MATCH_WEIGHTS.requiredSkills,
      score: 1,
      weightedScore: MATCH_WEIGHTS.requiredSkills,
      explanation: 'This job lists no specific required skills.',
      details: { matched: 0, total: 0 },
    };
  }

  const matched = required.filter((s) => userHasSkill(user.skills, s.name));
  const score = matched.length / total;

  return {
    id: 'requiredSkills',
    label: 'Required skills',
    weight: MATCH_WEIGHTS.requiredSkills,
    score,
    weightedScore: MATCH_WEIGHTS.requiredSkills * score,
    explanation:
      matched.length === total
        ? `You match all ${total} required skill${total === 1 ? '' : 's'}.`
        : `You match ${matched.length} of ${total} required skills.`,
    details: { matched: matched.length, total },
  };
}

// ---------------------------------------------------------------------------
// Factor 2: Preferred skills (10%)
// ---------------------------------------------------------------------------
function scorePreferredSkills(
  job: MatchJobInput,
  user: MatchUserProfile,
): MatchFactorResult {
  const preferred = job.skills.filter((s) => !s.isRequired);
  const total = preferred.length;

  if (total === 0) {
    return {
      id: 'preferredSkills',
      label: 'Preferred skills',
      weight: MATCH_WEIGHTS.preferredSkills,
      score: 1,
      weightedScore: MATCH_WEIGHTS.preferredSkills,
      explanation: 'This job lists no preferred skills.',
      details: { matched: 0, total: 0 },
    };
  }

  const matched = preferred.filter((s) => userHasSkill(user.skills, s.name));
  const score = matched.length / total;

  return {
    id: 'preferredSkills',
    label: 'Preferred skills',
    weight: MATCH_WEIGHTS.preferredSkills,
    score,
    weightedScore: MATCH_WEIGHTS.preferredSkills * score,
    explanation: `You match ${matched.length} of ${total} preferred skills.`,
        details: { matched: matched.length, total },
  };
}
// ---------------------------------------------------------------------------
// Factor 3: Experience level (15%)
// ---------------------------------------------------------------------------
function scoreExperience(
  job: MatchJobInput,
  user: MatchUserProfile,
): MatchFactorResult {
  const jobLevel = job.experienceLevel;
  const userLevel = user.experienceLevel;

  if (jobLevel === 'UNKNOWN' || userLevel === 'UNKNOWN') {
    return {
      id: 'experience',
      label: 'Experience level',
      weight: MATCH_WEIGHTS.experience,
      score: 0.5,
      weightedScore: MATCH_WEIGHTS.experience * 0.5,
      explanation: 'Experience level is unknown for one side — neutral score.',
    };
  }

  const jobIdx = EXPERIENCE_ORDER.indexOf(jobLevel);
  const userIdx = EXPERIENCE_ORDER.indexOf(userLevel);
  const distance = Math.abs(jobIdx - userIdx);

  let score: number;
  if (distance === 0) score = 1;
  else if (distance === 1) score = 0.6;
  else if (distance === 2) score = 0.2;
  else score = 0;

  return {
    id: 'experience',
    label: 'Experience level',
    weight: MATCH_WEIGHTS.experience,
    score,
    weightedScore: MATCH_WEIGHTS.experience * score,
    explanation:
      distance === 0
        ? `Your level (${userLevel}) is an exact match.`
        : distance === 1
          ? `Your level (${userLevel}) is close to the required ${jobLevel}.`
          : `Your level (${userLevel}) differs from the required ${jobLevel}.`,
    details: { jobLevel, userLevel, distance },
  };
}

// ---------------------------------------------------------------------------
// Factor 4: Job title similarity (15%)
// ---------------------------------------------------------------------------
function scoreTitle(
  job: MatchJobInput,
  user: MatchUserProfile,
): MatchFactorResult {
  const desired = user.desiredTitles.map(normalise).filter(Boolean);
  if (desired.length === 0 || !job.title) {
    return {
      id: 'title',
      label: 'Job title match',
      weight: MATCH_WEIGHTS.title,
      score: 0.4,
      weightedScore: MATCH_WEIGHTS.title * 0.4,
      explanation: user.desiredTitles.length === 0
        ? 'You have not set any desired job titles — neutral score.'
        : 'No job title to compare.',
    };
  }

  const jobTitle = normalise(job.title);
  const jobWords = new Set(jobTitle.split(' '));

  let bestScore = 0;
  let bestTitle = '';

  for (const title of desired) {
    if (title === jobTitle) {
      bestScore = 1;
      bestTitle = title;
      break;
    }
    if (jobTitle.includes(title) || title.includes(jobTitle)) {
      bestScore = Math.max(bestScore, 0.85);
      bestTitle = title;
      continue;
    }
    const titleWords = title.split(' ');
    const overlap = titleWords.filter((w) => jobWords.has(w)).length;
    const overlapScore = titleWords.length > 0 ? overlap / titleWords.length : 0;
    if (overlapScore > bestScore) {
      bestScore = overlapScore;
      bestTitle = title;
    }
  }

  bestScore = Math.min(bestScore, 0.7);

  return {
    id: 'title',
    label: 'Job title match',
    weight: MATCH_WEIGHTS.title,
    score: bestScore,
    weightedScore: MATCH_WEIGHTS.title * bestScore,
    explanation:
      bestScore >= 0.85
        ? `The title "${job.title}" closely matches your desired title "${bestTitle}".`
        : bestScore >= 0.4
          ? `The title "${job.title}" partially matches your desired titles.`
          : `The title "${job.title}" does not closely match your desired titles.`,
    details: { bestMatch: bestTitle, bestScore: Number(bestScore.toFixed(3)) },
  };
}

// ---------------------------------------------------------------------------
// Factor 5: Education (10%)
// ---------------------------------------------------------------------------
function scoreEducation(
  _job: MatchJobInput,
  _user: MatchUserProfile,
): MatchFactorResult {
  // The current data model does not capture formal education, so this factor
  // cannot be evaluated. We award full marks rather than penalising the user
  // for missing data. This is documented transparently.
  return {
    id: 'education',
    label: 'Education',
    weight: MATCH_WEIGHTS.education,
    score: 1,
    weightedScore: MATCH_WEIGHTS.education,
    explanation:
      'Education data is not collected yet — full marks awarded by default.',
  };
}
// ---------------------------------------------------------------------------
// Factor 6: Location + work mode (10%)
// ---------------------------------------------------------------------------
function scoreLocationWorkMode(
  job: MatchJobInput,
  user: MatchUserProfile,
): MatchFactorResult {
  // --- Work mode sub-score (up to half the factor weight) ---
  let workModeScore = 0;
  if (job.workMode === 'UNKNOWN' || user.workMode === 'UNKNOWN') {
    workModeScore = 0.5;
  } else if (job.workMode === user.workMode) {
    workModeScore = 1;
  } else if (
    (job.workMode === 'REMOTE' && user.workMode === 'HYBRID') ||
    (job.workMode === 'HYBRID' && user.workMode === 'REMOTE')
  ) {
    workModeScore = 0.7;
  } else {
    workModeScore = 0.2;
  }

  const remoteJob = job.workMode === 'REMOTE';

  // --- Location sub-score (up to half the factor weight) ---
  let locationScore = 0;
  if (remoteJob) {
    locationScore = 1;
  } else if (!job.location || user.preferredLocations.length === 0) {
    locationScore = 0.5;
  } else {
    const jobLoc = normalise(job.location);
    const matched = user.preferredLocations.some((pref) => {
      const p = normalise(pref);
      return jobLoc.includes(p) || p.includes(jobLoc);
    });
    locationScore = matched ? 1 : 0.2;
  }

  const score = workModeScore * 0.5 + locationScore * 0.5;

  return {
    id: 'locationWorkMode',
    label: 'Location & work mode',
    weight: MATCH_WEIGHTS.locationWorkMode,
    score,
    weightedScore: MATCH_WEIGHTS.locationWorkMode * score,
    explanation: `Work mode ${job.workMode.toLowerCase()} vs your ${user.workMode.toLowerCase()}${
      job.location ? `, location "${job.location}"` : ''
    }.`,
    details: { workModeScore, locationScore, remoteJob },
  };
}

// ---------------------------------------------------------------------------
// Factor 7: Salary (5%)
// ---------------------------------------------------------------------------
function scoreSalary(
  job: MatchJobInput,
  user: MatchUserProfile,
): MatchFactorResult {
  if (
    (job.salaryMin == null && job.salaryMax == null) ||
    (user.salaryMin == null && user.salaryMax == null)
  ) {
    return {
      id: 'salary',
      label: 'Salary',
      weight: MATCH_WEIGHTS.salary,
      score: 1,
      weightedScore: MATCH_WEIGHTS.salary,
      explanation: 'Salary expectations are not set — full marks awarded.',
    };
  }

  const jobMin = job.salaryMin ?? job.salaryMax ?? 0;
  const jobMax = job.salaryMax ?? job.salaryMin ?? 0;
  const userMin = user.salaryMin ?? user.salaryMax ?? 0;
  const userMax = user.salaryMax ?? user.salaryMin ?? 0;

  if (
    job.salaryCurrency &&
    user.salaryCurrency &&
    job.salaryCurrency !== user.salaryCurrency
  ) {
    return {
      id: 'salary',
      label: 'Salary',
      weight: MATCH_WEIGHTS.salary,
      score: 0.5,
      weightedScore: MATCH_WEIGHTS.salary * 0.5,
      explanation: `Currency mismatch (${job.salaryCurrency} vs ${user.salaryCurrency}).`,
    };
  }

  const overlapStart = Math.max(jobMin, userMin);
  const overlapEnd = Math.min(jobMax, userMax);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  if (overlap <= 0) {
    return {
      id: 'salary',
      label: 'Salary',
      weight: MATCH_WEIGHTS.salary,
      score: 0,
      weightedScore: 0,
      explanation: 'Your salary expectations do not overlap with the job range.',
    };
  }

  const jobRange = jobMax - jobMin || jobMax || 1;
  const score = Math.min(overlap / jobRange, 1);

  return {
    id: 'salary',
    label: 'Salary',
    weight: MATCH_WEIGHTS.salary,
    score,
    weightedScore: MATCH_WEIGHTS.salary * score,
    explanation: `Your salary range overlaps ${Math.round(score * 100)}% with the job range.`,
    details: { overlap, jobMin, jobMax, userMin, userMax },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scores a single job against the user profile. Pure & deterministic.
 */
export function scoreJob(
  job: MatchJobInput,
  user: MatchUserProfile,
): Omit<MatchResult, 'aiExplanation' | 'aiUsed'> {
  const factors: MatchFactorResult[] = [
    scoreRequiredSkills(job, user),
    scorePreferredSkills(job, user),
    scoreExperience(job, user),
    scoreTitle(job, user),
    scoreEducation(job, user),
    scoreLocationWorkMode(job, user),
    scoreSalary(job, user),
  ];

  const rawTotal = factors.reduce((sum, f) => sum + f.weightedScore, 0);
  const score = Math.round(rawTotal * 100);

  const matchedRequiredSkills = job.skills
    .filter((s) => s.isRequired && userHasSkill(user.skills, s.name))
    .map((s) => s.name);
  const missingRequiredSkills = job.skills
    .filter((s) => s.isRequired && !userHasSkill(user.skills, s.name))
    .map((s) => s.name);
  const matchedPreferredSkills = job.skills
    .filter((s) => !s.isRequired && userHasSkill(user.skills, s.name))
    .map((s) => s.name);

  return {
    jobId: job.id,
    score,
    factors,
    matchedRequiredSkills,
    missingRequiredSkills,
    matchedPreferredSkills,
    recommendation: scoreToRecommendation(score),
    computedAt: new Date().toISOString(),
  };
}

/**
 * Scores all jobs, sorted by score descending.
 */
export function scoreAllJobs(
  jobs: MatchJobInput[],
  user: MatchUserProfile,
): Array<Omit<MatchResult, 'aiExplanation' | 'aiUsed'>> {
  return jobs
    .map((job) => scoreJob(job, user))
    .sort((a, b) => b.score - a.score);
}