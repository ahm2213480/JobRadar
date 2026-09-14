import { describe, expect, it } from 'vitest';
import { JSearchProvider, buildLocation, mapEmploymentType, toYearly } from './jsearch.adapter';
import { AdzunaProvider } from './adzuna.adapter';

describe('JSearch adapter mapping', () => {
  it('maps a LinkedIn-style payload onto NormalizedJob', () => {
    const provider = new JSearchProvider();
    const job = provider.mapJob({
      job_id: 'abc123',
      job_title: 'React Developer',
      employer_name: 'Acme',
      job_description: 'Build things with React in Amman.',
      job_city: 'Amman',
      job_country: 'Jordan',
      job_is_remote: false,
      job_min_salary: 2000,
      job_max_salary: 3000,
      job_salary_currency: 'USD',
      job_salary_period: 'MONTH',
      job_posted_at_datetime_utc: '2026-09-01T10:00:00.000Z',
      job_apply_link: 'https://www.linkedin.com/jobs/view/abc123',
      job_required_skills: ['React', 'TypeScript'],
    });
    expect(job.externalId).toBe('jsearch:abc123');
    expect(job.title).toBe('React Developer');
    expect(job.location).toBe('Amman, Jordan');
    expect(job.url).toContain('linkedin.com');
    expect(job.salaryMin).toBe(24000);
    expect(job.salaryMax).toBe(36000);
    expect(job.tags).toContain('React');
  });

  it('handles a missing/unreachable key without hanging the suite', async () => {
    // NOTE: this environment has a real JSEARCH_API_KEY in server/.env, so
    // the provider attempts 8 live queries (12s timeout each + 0.5s pacing).
    // The per-query isolation + 12s cap is exactly what this test exercises:
    // every query fails fast (404 from RapidAPI here) and the loop finishes.
    const jobs = await new JSearchProvider().fetchJobs();
    expect(Array.isArray(jobs)).toBe(true);
  }, 120_000);

  it('converts salary periods to yearly', () => {
    expect(toYearly(25, 'HOUR')).toBe(52000);
    expect(toYearly(2000, 'MONTH')).toBe(24000);
    expect(toYearly(90000, 'YEAR')).toBe(90000);
  });

  it('maps employment types and locations', () => {
    expect(mapEmploymentType('FULL_TIME')).toBe('FULL_TIME');
    expect(buildLocation({ job_city: 'Amman', job_country: 'Jordan' })).toBe('Amman, Jordan');
  });
});

describe('Adzuna adapter mapping', () => {
  it('maps an Adzuna payload onto NormalizedJob', () => {
    const provider = new AdzunaProvider();
    const job = provider.mapJob(
      {
        id: '999',
        title: 'Backend Developer',
        description: 'Python role in London.',
        created: '2026-08-15T09:00:00Z',
        redirect_url: 'https://www.adzuna.co.uk/jobs/land/ad/999',
        company: { display_name: 'Beta Ltd' },
        location: { display_name: 'London', area: ['UK', 'London'] },
        contract_time: 'full_time',
        salary_min: 50000,
        salary_max: 65000,
      },
      'gb',
    );
    expect(job.externalId).toBe('adzuna:gb:999');
    expect(job.salaryCurrency).toBe('GBP');
    expect(job.employmentType).toBe('FULL_TIME');
  });

  it('returns [] without credentials', async () => {
    const jobs = await new AdzunaProvider().fetchJobs();
    expect(jobs).toEqual([]);
  });
});
