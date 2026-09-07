import type { NormalizedJob } from './IJobProvider';

const strip = (value: string) => value.replace(/\s+/g, ' ').trim();
const clean = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

/** Content fingerprint used for de-duplication within a source. */
export function jobFingerprint(job: {
  title: string;
  companyName: string | null;
  description: string;
  location: string | null;
}): string {
  return clean(
    [job.title, job.companyName, job.location, job.description.slice(0, 2000)].join(' | '),
  );
}

const CURRENCY_PATTERNS: Array<{ symbol: string; currency: string }> = [
  { symbol: '$', currency: 'USD' },
  { symbol: '€', currency: 'EUR' },
  { symbol: '£', currency: 'GBP' },
];

/**
 * Parses "40k - 60k", "$40,000-$60,000", "€50-70k" style salary text into
 * numeric min/max + a 3-letter currency. Returns nulls when it can't parse.
 */
export function parseSalary(
  salaryText?: string | null,
): Pick<NormalizedJob, 'salaryMin' | 'salaryMax' | 'salaryCurrency'> {
  const raw = salaryText?.trim();
  if (!raw) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null };
  }

  let currency: string | null = null;
  for (const entry of CURRENCY_PATTERNS) {
    if (raw.includes(entry.symbol)) {
      currency = entry.currency;
      break;
    }
  }

  const kNumbers = raw.match(/(\d{1,3}(?:\.\d{1,3})?)\s*k/gi);
  if (kNumbers && kNumbers.length >= 1) {
    const nums = kNumbers.map((part) =>
      Math.round(Number(part.replace(/[^\d.]/g, '')) * 1000),
    );
    return {
      salaryMin: nums[0] ?? null,
      salaryMax: nums.length >= 2 && nums[0] !== nums[1] ? nums[1] : null,
      salaryCurrency: currency,
    };
  }

  const fullNumbers = raw.match(/\d[\d,]{2,}/g);
  if (fullNumbers && fullNumbers.length >= 1) {
    const nums = fullNumbers.map((part) => Number(part.replace(/,/g, '')));
    return {
      salaryMin: nums[0] ?? null,
      salaryMax: nums.length >= 2 && nums[0] !== nums[1] ? nums[1] : null,
      salaryCurrency: currency,
    };
  }

  return { salaryMin: null, salaryMax: null, salaryCurrency: null };
}

/** Infers work mode from free text, preferring explicit remote/hybrid hints. */
export function inferWorkMode(parts: Array<string | null | undefined>): NormalizedJob['workMode'] {
  const text = clean(parts.filter(Boolean).join(' '));
  if (/\b(remote|work from home|wfh|telecommute)\b/.test(text)) {
    return 'REMOTE';
  }
  if (/\bhybrid\b/.test(text)) {
    return 'HYBRID';
  }
  if (/\bon[- ]?site|in[- ]office|on site\b/.test(text)) {
    return 'ONSITE';
  }
  return 'UNKNOWN';
}

/** Compact edition of a description for fingerprinting/search. */
export function truncateDescription(description: string): string {
  return strip(description).slice(0, 8000);
}

export { clean, strip };