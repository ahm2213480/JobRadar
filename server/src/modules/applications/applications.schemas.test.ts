import { describe, expect, it } from 'vitest';
import {
  createApplicationSchema,
  createInterviewSchema,
  createNoteSchema,
  interviewIdParamSchema,
  noteIdParamSchema,
  updateInterviewSchema,
} from './applications.schemas';

/** Returns the array of error path strings from a failed parse. */
function errorPaths(parse: {
  success: boolean;
  error?: { issues: Array<{ path: Array<string | number> }> };
}): string[] {
  if (parse.success) return [];
  return (parse.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('application notes schemas', () => {
  it('accepts a valid note body', () => {
    expect(createNoteSchema.safeParse({ body: 'Follow up next week' }).success).toBe(true);
  });

  it('rejects an empty or whitespace-only note body', () => {
    expect(createNoteSchema.safeParse({ body: '' }).success).toBe(false);
    expect(createNoteSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('rejects an over-length note body', () => {
    expect(createNoteSchema.safeParse({ body: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('parses nested note route params', () => {
    const result = noteIdParamSchema.safeParse({
      id: 'app-1',
      noteId: 'note-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: 'app-1', noteId: 'note-1' });
    }
    expect(noteIdParamSchema.safeParse({ id: 'app-1', noteId: '' }).success).toBe(false);
  });
});

describe('interview schemas', () => {
  const validBase = { scheduledAt: '2026-10-01T10:00:00.000Z' };

  it('accepts a minimal interview', () => {
    expect(createInterviewSchema.safeParse(validBase).success).toBe(true);
  });

  it('accepts a full interview with enum values', () => {
    const result = createInterviewSchema.safeParse({
      scheduledAt: validBase.scheduledAt,
      type: 'FINAL',
      locationOrLink: 'https://meet.example.com/abc',
      notes: 'Panel of 3 engineers',
      outcome: 'PASSED',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing scheduledAt', () => {
    const result = createInterviewSchema.safeParse({ type: 'HR' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorPaths(result)).toContain('scheduledAt');
    }
  });

  it('rejects an unknown interview type', () => {
    const result = createInterviewSchema.safeParse({
      scheduledAt: validBase.scheduledAt,
      type: 'TECHNICAL_INTERVIEW',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown outcome', () => {
    const result = createInterviewSchema.safeParse({
      scheduledAt: validBase.scheduledAt,
      outcome: 'MAYBE',
    });
    expect(result.success).toBe(false);
  });

  it('accepts the exact InterviewType enum values', () => {
    for (const type of ['PHONE_SCREENING', 'TECHNICAL', 'HR', 'FINAL', 'ONSITE', 'OTHER']) {
      expect(
        createInterviewSchema.safeParse({ scheduledAt: validBase.scheduledAt, type }).success,
      ).toBe(true);
    }
  });

  it('accepts the exact InterviewOutcome enum values', () => {
    for (const outcome of ['PENDING', 'PASSED', 'FAILED']) {
      expect(
        createInterviewSchema.safeParse({ scheduledAt: validBase.scheduledAt, outcome }).success,
      ).toBe(true);
    }
  });

  it('update schema requires at least one field', () => {
    expect(updateInterviewSchema.safeParse({}).success).toBe(false);
    expect(updateInterviewSchema.safeParse({ outcome: 'FAILED' }).success).toBe(true);
    // Explicit null clears an optional field.
    expect(updateInterviewSchema.safeParse({ locationOrLink: null }).success).toBe(true);
  });

  it('parses nested interview route params', () => {
    const result = interviewIdParamSchema.safeParse({
      id: 'app-1',
      interviewId: 'int-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: 'app-1', interviewId: 'int-1' });
    }
    expect(
      interviewIdParamSchema.safeParse({ id: 'app-1', interviewId: ' ' }).success,
    ).toBe(false);
  });
});

describe('application create schema (jobId XOR title)', () => {
  it('accepts a jobId-only application', () => {
    expect(createApplicationSchema.safeParse({ jobId: 'job-1' }).success).toBe(true);
  });

  it('accepts a manual application with a title', () => {
    expect(createApplicationSchema.safeParse({ title: 'Frontend Engineer' }).success).toBe(true);
  });

  it('rejects an application with neither jobId nor title', () => {
    const result = createApplicationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorPaths(result)).toContain('title');
    }
  });
});