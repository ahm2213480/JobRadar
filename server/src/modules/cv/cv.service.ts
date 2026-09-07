import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CV } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { aiService, type CvAnalysis } from '../../services/ai';
import {
  detectMagicType,
  extensionFor,
  extractCvText,
} from '../../services/cv/parsers';

const UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads');

export interface CvRecordDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  uploadedAt: string;
  analyzedAt: string | null;
  skillCount: number;
}

export interface AnalyzeCvResult {
  cv: CvRecordDto;
  analysis: CvAnalysis;
  skills: Array<{ id: string; name: string }>;
  provider: string;
}

interface StoredParsed {
  analyzedAt?: string;
  skillCount?: number;
}

function toCvDto(cv: CV): CvRecordDto {
  const parsed = (cv.parsed as StoredParsed | null) ?? null;
  return {
    id: cv.id,
    fileName: cv.fileName,
    mimeType: cv.mimeType,
    sizeBytes: cv.sizeBytes,
    isPrimary: cv.isPrimary,
    uploadedAt: cv.uploadedAt.toISOString(),
    analyzedAt: parsed?.analyzedAt ?? null,
    skillCount: parsed?.skillCount ?? 0,
  };
}

/** Empty strings from the AI are treated as "not present". */
function nullableText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Persists the submitted file AFTER validating its magic bytes, extracts the
 * raw text, and stores the record. The first uploaded CV becomes primary.
 */
export async function createCv(
  userId: string,
  file: Express.Multer.File,
): Promise<CvRecordDto> {
  const detected = detectMagicType(file.buffer);
  if (!detected) {
    throw new AppError(400, 'Unsupported file type. Only PDF and DOCX resumes are accepted.');
  }
  // Also validates the file is a real PDF/DOCX and text-extractable.
  const rawText = await extractCvText(file.buffer, file.mimetype);

  const storedName = `${randomUUID()}.${extensionFor(detected)}`;
  const relativePath = path.join(userId, storedName);
  const absolutePath = path.join(UPLOAD_ROOT, relativePath);

  try {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);
  } catch (error) {
    logger.error('Failed to persist CV file', error);
    throw new AppError(500, 'Failed to store the uploaded file');
  }

  let cv: CV;
  try {
    cv = await prisma.cV.create({
      data: {
        userId,
        fileName: file.originalname,
        filePath: relativePath,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        rawText,
      },
    });
  } catch (error) {
    await fs.unlink(absolutePath).catch(() => undefined);
    logger.error('Failed to save CV record', error);
    throw new AppError(500, 'Failed to save the CV');
  }

  const primaryCount = await prisma.cV.count({ where: { userId, isPrimary: true } });
  if (primaryCount === 0) {
    cv = await prisma.cV.update({ where: { id: cv.id }, data: { isPrimary: true } });
  }

  return toCvDto(cv);
}

export async function listCvs(userId: string): Promise<CvRecordDto[]> {
  const cvs = await prisma.cV.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
  });
  return cvs.map(toCvDto);
}

export async function setPrimaryCv(
  userId: string,
  cvId: string,
): Promise<CvRecordDto> {
  const cv = await prisma.cV.findFirst({ where: { id: cvId, userId } });
  if (!cv) {
    throw new AppError(404, 'CV not found');
  }
  await prisma.$transaction([
    prisma.cV.updateMany({ where: { userId }, data: { isPrimary: false } }),
    prisma.cV.update({ where: { id: cvId }, data: { isPrimary: true } }),
  ]);
  const updated = await prisma.cV.findUniqueOrThrow({ where: { id: cvId } });
  return toCvDto(updated);
}

export async function deleteCv(userId: string, cvId: string): Promise<void> {
  const cv = await prisma.cV.findFirst({ where: { id: cvId, userId } });
  if (!cv) {
    throw new AppError(404, 'CV not found');
  }
  const wasPrimary = cv.isPrimary;
  await prisma.cV.delete({ where: { id: cvId } });
  await fs.unlink(path.join(UPLOAD_ROOT, cv.filePath)).catch(() => undefined);

  // When the primary CV is deleted, promote the most recent remaining one.
  if (wasPrimary) {
    const next = await prisma.cV.findFirst({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
    if (next) {
      await prisma.cV.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }
}
/**
 * Runs the AI analysis on the CV's extracted text, saves the detected skills
 * to the user's skill set (source = AI) and fills empty profile fields.
 */
export async function analyzeCv(
  userId: string,
  cvId: string,
): Promise<AnalyzeCvResult> {
  const cv = await prisma.cV.findFirst({ where: { id: cvId, userId } });
  if (!cv) {
    throw new AppError(404, 'CV not found');
  }
  if (!cv.rawText) {
    throw new AppError(
      400,
      'This CV has no extractable text — upload a PDF/DOCX version instead.',
    );
  }

  const analysis = await aiService.analyzeCV(cv.rawText);

  // ---- Save extracted skills (source = AI) ----
  const savedSkills: Array<{ id: string; name: string }> = [];
  for (const extracted of analysis.skills) {
    let skill = await prisma.skill.findFirst({
      where: { name: { equals: extracted.name, mode: 'insensitive' } },
    });
    if (!skill) {
      skill = await prisma.skill.create({
        data: {
          name: extracted.name,
          category: extracted.category,
          aliases: [extracted.name.toLowerCase()],
        },
      });
    }
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      update: {
        proficiency: extracted.proficiency ?? null,
        years: extracted.years ?? null,
        source: 'AI',
      },
      create: {
        userId,
        skillId: skill.id,
        proficiency: extracted.proficiency ?? null,
        years: extracted.years ?? null,
        source: 'AI',
      },
    });
    savedSkills.push({ id: skill.id, name: skill.name });
  }

  // ---- Fill profile fields the user hasn't set manually yet ----
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const patch: Record<string, string | number> = {};
  const ap = analysis.profile;
  if (!profile?.currentTitle && ap.currentTitle) patch.currentTitle = ap.currentTitle;
  if (!profile?.headline && ap.headline) patch.headline = ap.headline;
  if (!profile?.summary && ap.summary) patch.summary = ap.summary;
  if (!profile?.location && ap.location) patch.location = ap.location;
  if (!profile?.phone && ap.phone) patch.phone = ap.phone;
  if (!profile?.linkedinUrl && ap.linkedinUrl) patch.linkedinUrl = ap.linkedinUrl;
  if (!profile?.githubUrl && ap.githubUrl) patch.githubUrl = ap.githubUrl;
  if (!profile?.portfolioUrl && ap.portfolioUrl) patch.portfolioUrl = ap.portfolioUrl;
  if (
    profile?.yearsOfExperience == null &&
    ap.yearsOfExperience != null &&
    ap.yearsOfExperience > 0
  ) {
    patch.yearsOfExperience = ap.yearsOfExperience;
  }

  // Normalize free-text values: trim, drop empty values.
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (typeof value === 'string') {
      const normalized = nullableText(value);
      if (normalized) {
        patch[key] = normalized;
      } else {
        delete patch[key];
      }
    }
  }

  if (Object.keys(patch).length > 0) {
    await prisma.userProfile.upsert({
      where: { userId },
      update: patch,
      create: { userId, ...patch },
    });
  }

  const updated = await prisma.cV.update({
    where: { id: cvId },
    data: {
      parsed: {
        analyzedAt: new Date().toISOString(),
        provider: aiService.name,
        skillCount: savedSkills.length,
      },
    },
  });

  return {
    cv: toCvDto(updated),
    analysis,
    skills: savedSkills,
    provider: aiService.name,
  };
}