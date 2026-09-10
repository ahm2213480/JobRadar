import { describe, it, expect } from 'vitest';
import { scoreJob, scoreAllJobs } from './algorithm';
import type { MatchJobInput, MatchUserProfile } from './types';

/** A baseline user profile used across tests. */
const baseUser: MatchUserProfile = {
  currentTitle: 'Senior Full Stack Developer',
  yearsOfExperience: 5,
  location: 'Amman, Jordan',
  desiredTitles: ['Senior Full Stack Developer', 'Lead Developer'],
  preferredLocations: ['Amman', 'Remote'],
  preferredTechnologies: ['React', 'Node.js'],
  workMode: 'REMOTE',
  experienceLevel: 'SENIOR',
  salaryMin: 2000,
  salaryMax: 3500,
  salaryCurrency: 'USD',
  remoteOnly: false,
  skills: [
    { name: 'JavaScript', aliases: ['js'] },
    { name: 'TypeScript', aliases: ['ts'] },
    { name: 'React', aliases: ['reactjs', 'react.js'] },
    { name: 'Node.js', aliases: ['nodejs', 'node'] },
    { name: 'PostgreSQL', aliases: ['postgres'] },
  ],
};

const baseJob: MatchJobInput = {
  id: 'job-1',
  title: 'Senior Full Stack Developer',
  location: 'Remote',
  workMode: 'REMOTE',
  experienceLevel: 'SENIOR',
  salaryMin: 2000,
  salaryMax: 3500,
  salaryCurrency: 'USD',
  skills: [
    { name: 'JavaScript', isRequired: true },
    { name: 'TypeScript', isRequired: true },
    { name: 'React', isRequired: true },
    { name: 'Node.js', isRequired: true },
    { name: 'Docker', isRequired: false },
  ],
};

describe('scoreJob — deterministic matching algorithm', () => {
  it('returns a score between 0 and 100', () => {
    const result = scoreJob(baseJob, baseUser);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('is deterministic — same inputs → same output', () => {
    const a = scoreJob(baseJob, baseUser);
    const b = scoreJob(baseJob, baseUser);
    expect(a.score).toBe(b.score);
    // computedAt is a timestamp — compare it separately with tolerance.
    expect(Math.abs(new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime())).toBeLessThan(1000);
    const { computedAt: _a, ...restA } = a;
    const { computedAt: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });

  it('awards a high score for a strong match', () => {
    const result = scoreJob(baseJob, baseUser);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.matchedRequiredSkills).toContain('JavaScript');
    expect(result.matchedRequiredSkills).toContain('TypeScript');
    expect(result.matchedRequiredSkills).toContain('React');
    expect(result.matchedRequiredSkills).toContain('Node.js');
  });

  it('gives a low score when user has no matching skills', () => {
    const emptyUser: MatchUserProfile = {
      ...baseUser,
      skills: [],
      desiredTitles: [],
      workMode: 'ONSITE',
      experienceLevel: 'INTERNSHIP',
      salaryMin: 5000,
      salaryMax: 6000,
    };
    const result = scoreJob(baseJob, emptyUser);
    expect(result.score).toBeLessThan(40);
  });

  it('matches skills by alias (js → JavaScript)', () => {
    const userWithAlias: MatchUserProfile = {
      ...baseUser,
      skills: [{ name: 'JavaScript', aliases: ['js'] }],
    };
    const job: MatchJobInput = {
      ...baseJob,
      skills: [{ name: 'JavaScript', isRequired: true }],
    };
    const result = scoreJob(job, userWithAlias);
    expect(result.matchedRequiredSkills).toContain('JavaScript');
  });

  it('handles jobs with no required skills gracefully', () => {
    const job: MatchJobInput = {
      ...baseJob,
      skills: [{ name: 'Docker', isRequired: false }],
    };
    const result = scoreJob(job, baseUser);
    const requiredFactor = result.factors.find((f) => f.id === 'requiredSkills')!;
    expect(requiredFactor.score).toBe(1);
    expect(result.score).toBeGreaterThan(0);
  });

  it('penalises experience level mismatch', () => {
    const juniorUser: MatchUserProfile = { ...baseUser, experienceLevel: 'JUNIOR' };
    const seniorJob: MatchJobInput = { ...baseJob, experienceLevel: 'LEAD' };
    const result = scoreJob(seniorJob, juniorUser);
    const expFactor = result.factors.find((f) => f.id === 'experience')!;
    expect(expFactor.score).toBe(0);
  });

  it('awards partial credit for adjacent experience levels', () => {
    const midUser: MatchUserProfile = { ...baseUser, experienceLevel: 'MID_LEVEL' };
    const seniorJob: MatchJobInput = { ...baseJob, experienceLevel: 'SENIOR' };
    const result = scoreJob(seniorJob, midUser);
        const expFactor = result.factors.find((f) => f.id === 'experience')!;
    expect(expFactor.score).toBe(0.6);
  });
});

describe('scoreAllJobs — batch matching', () => {
  it('scores every job and returns them sorted descending', () => {
    const weakJob: MatchJobInput = {
      ...baseJob,
      id: 'weak',
      title: 'Junior Designer',
      skills: [{ name: 'Photoshop', isRequired: true }],
    };
    const strongJob: MatchJobInput = {
      ...baseJob,
      id: 'strong',
      title: 'Senior Full Stack Developer',
    };
    const results = scoreAllJobs([weakJob, strongJob], baseUser);
    expect(results).toHaveLength(2);
    expect(results[0].jobId).toBe('strong');
    expect(results[1].jobId).toBe('weak');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('handles an empty job list gracefully', () => {
    expect(scoreAllJobs([], baseUser)).toEqual([]);
  });

  it('handles a profile with no skills', () => {
    const noSkillUser: MatchUserProfile = { ...baseUser, skills: [] };
    const results = scoreAllJobs([baseJob], noSkillUser);
    // Without skills the user still scores on experience, title, education
    // (full marks — not collected yet), location/work-mode and salary.
    // The algorithm correctly produces ~51 in that scenario.
    expect(results[0].score).toBeLessThan(55);
    expect(results[0].score).toBeGreaterThan(45);
    expect(results[0].matchedRequiredSkills).toHaveLength(0);
  });
});