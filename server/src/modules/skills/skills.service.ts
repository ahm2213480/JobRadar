import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import type { CreateLearningGoalInput, UpdateLearningGoalInput } from './skills.schemas';

// --------------------------- Skills gap analysis ---------------------------
// Computed on demand from job_skills vs user_skills — no extra table, per the
// approved architecture. Fully deterministic (no AI involved).

export interface SkillGapItem {
  skillId: string;
  name: string;
  category: string;
  /** How many jobs in the feed require/prefer this skill. */
  demandCount: number;
  /** demandCount / totalJobs in the feed, as a 0-100 percentage. */
  demandPct: number;
  /** Whether the authenticated user already has this skill. */
  owned: boolean;
}

export interface SkillsGapResult {
  totalJobs: number;
  /** Missing skills, highest demand first. */
  gaps: SkillGapItem[];
  /** Skills the user already has that the market wants (context). */
  strengths: SkillGapItem[];
}

export async function computeSkillsGap(userId: string): Promise<SkillsGapResult> {
  const [totalJobs, demandRows, userSkills] = await Promise.all([
    prisma.job.count(),
    prisma.jobSkill.groupBy({
      by: ['skillId'],
      _count: { skillId: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: 40,
    }),
    prisma.userSkill.findMany({
      where: { userId },
      select: { skillId: true },
    }),
  ]);

  const owned = new Set(userSkills.map((row) => row.skillId));
  const skillIds = demandRows.map((row) => row.skillId);
  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, name: true, category: true },
  });
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));

  const items: SkillGapItem[] = demandRows
    .filter((row) => skillById.has(row.skillId))
    .map((row) => {
      const skill = skillById.get(row.skillId)!;
      const demandCount = row._count.skillId;
      return {
        skillId: skill.id,
        name: skill.name,
        category: skill.category,
        demandCount,
        demandPct: totalJobs > 0 ? Math.round((demandCount / totalJobs) * 100) : 0,
        owned: owned.has(skill.id),
      };
    });

  return {
    totalJobs,
    gaps: items.filter((item) => !item.owned),
    strengths: items.filter((item) => item.owned),
  };
}

// ---------------------------- Learning goals ----------------------------

export interface LearningGoalListItem {
  id: string;
  skillId: string;
  skillName: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

function toListItem(row: {
  id: string;
  skillId: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  skill: { name: string };
}): LearningGoalListItem {
  return {
    id: row.id,
    skillId: row.skillId,
    skillName: row.skill.name,
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const goalInclude = {
  skill: { select: { name: true } },
} satisfies Prisma.LearningGoalInclude & Record<string, unknown>;

export async function listLearningGoals(userId: string): Promise<LearningGoalListItem[]> {
  const rows = await prisma.learningGoal.findMany({
    where: { userId },
    include: goalInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toListItem);
}

export async function createLearningGoal(
  userId: string,
  input: CreateLearningGoalInput,
): Promise<LearningGoalListItem> {
  const skill = await prisma.skill.findUnique({
    where: { id: input.skillId },
    select: { id: true },
  });
  if (!skill) {
    throw new AppError(400, 'Skill not found');
  }

  try {
    const row = await prisma.learningGoal.create({
      data: {
        userId,
        skillId: input.skillId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
      include: goalInclude,
    });
    return toListItem(row);
  } catch (error) {
    // @@unique? Not defined on LearningGoal — a duplicate goal is acceptable,
    // but a broken skillId FK surfaces as P2003.
    if (
      error instanceof Object &&
      'code' in error &&
      (error as { code: string }).code === 'P2003'
    ) {
      throw new AppError(400, 'Skill not found');
    }
    throw error;
  }
}

export async function updateLearningGoal(
  userId: string,
  goalId: string,
  input: UpdateLearningGoalInput,
): Promise<LearningGoalListItem> {
  const existing = await prisma.learningGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Learning goal not found');
  }

  const data: Prisma.LearningGoalUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate === null ? null : new Date(input.dueDate);
  }

  const row = await prisma.learningGoal.update({
    where: { id: goalId },
    data,
    include: goalInclude,
  });
  return toListItem(row);
}

export async function deleteLearningGoal(userId: string, goalId: string): Promise<void> {
  const result = await prisma.learningGoal.deleteMany({
    where: { id: goalId, userId },
  });
  if (result.count === 0) {
    throw new AppError(404, 'Learning goal not found');
  }
}