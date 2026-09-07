import type { SkillCategory } from '@prisma/client';
import { cvAnalysisSchema, type CvAnalysis } from './cv-analysis.schema';
import type { IAIService } from './IAIService';

/**
 * Built-in heuristic CV extractor. Used when no AI_API_KEY is configured so
 * the whole Phase 3 flow (upload → parse → extract → save skills) is testable
 * without any external service. Deliberately conservative: it only extracts
 * what it can find reliably in the text.
 *
 * When a real provider key is added, THIS whole class is bypassed — that is
 * the point of the IAIService interface.
 */

interface SkillKeyword {
  name: string;
  category: SkillCategory;
  keywords: string[];
}

const SKILL_KEYWORDS: SkillKeyword[] = [
  { name: 'JavaScript', category: 'PROGRAMMING_LANGUAGE', keywords: ['javascript'] },
  { name: 'TypeScript', category: 'PROGRAMMING_LANGUAGE', keywords: ['typescript'] },
  { name: 'Python', category: 'PROGRAMMING_LANGUAGE', keywords: ['python'] },
  { name: 'Java', category: 'PROGRAMMING_LANGUAGE', keywords: ['java'] },
  { name: 'C#', category: 'PROGRAMMING_LANGUAGE', keywords: ['c#', 'csharp', 'c sharp'] },
  { name: 'C++', category: 'PROGRAMMING_LANGUAGE', keywords: ['c++'] },
  { name: 'Go', category: 'PROGRAMMING_LANGUAGE', keywords: ['golang', 'go lang'] },
  { name: 'PHP', category: 'PROGRAMMING_LANGUAGE', keywords: ['php'] },
  { name: 'Ruby', category: 'PROGRAMMING_LANGUAGE', keywords: ['ruby'] },
  { name: 'SQL', category: 'PROGRAMMING_LANGUAGE', keywords: ['sql'] },
  { name: 'HTML', category: 'PROGRAMMING_LANGUAGE', keywords: ['html'] },
  { name: 'CSS', category: 'PROGRAMMING_LANGUAGE', keywords: ['css'] },
  { name: 'GraphQL', category: 'PROGRAMMING_LANGUAGE', keywords: ['graphql'] },
  { name: 'Bash', category: 'PROGRAMMING_LANGUAGE', keywords: ['bash', 'shell scripting'] },
  { name: 'React', category: 'FRAMEWORK', keywords: ['react ', 'react.js', 'reactjs', 'react js'] },
  { name: 'React Native', category: 'FRAMEWORK', keywords: ['react native'] },
  { name: 'Next.js', category: 'FRAMEWORK', keywords: ['next.js', 'nextjs', 'next js'] },
  { name: 'Angular', category: 'FRAMEWORK', keywords: ['angular'] },
  { name: 'Vue.js', category: 'FRAMEWORK', keywords: ['vue'] },
  { name: 'Svelte', category: 'FRAMEWORK', keywords: ['svelte'] },
  { name: 'Node.js', category: 'FRAMEWORK', keywords: ['node.js', 'nodejs', 'node js'] },
  { name: 'Express', category: 'FRAMEWORK', keywords: ['express'] },
  { name: 'NestJS', category: 'FRAMEWORK', keywords: ['nestjs', 'nest js'] },
  { name: 'Django', category: 'FRAMEWORK', keywords: ['django'] },
  { name: 'Flask', category: 'FRAMEWORK', keywords: ['flask'] },
  { name: 'Spring Boot', category: 'FRAMEWORK', keywords: ['spring boot', 'spring'] },
  { name: 'Laravel', category: 'FRAMEWORK', keywords: ['laravel'] },
  { name: '.NET', category: 'FRAMEWORK', keywords: ['.net', 'asp.net', 'aspnet'] },
  { name: 'Tailwind CSS', category: 'FRAMEWORK', keywords: ['tailwind'] },
  { name: 'Flutter', category: 'FRAMEWORK', keywords: ['flutter'] },
  { name: 'Redux', category: 'FRAMEWORK', keywords: ['redux'] },
  { name: 'Git', category: 'TOOL', keywords: ['git'] },
  { name: 'GitHub', category: 'TOOL', keywords: ['github'] },
  { name: 'Docker', category: 'TOOL', keywords: ['docker'] },
  { name: 'Kubernetes', category: 'TOOL', keywords: ['kubernetes', 'k8s'] },
  { name: 'AWS', category: 'TOOL', keywords: ['aws'] },
  { name: 'Terraform', category: 'TOOL', keywords: ['terraform'] },
  { name: 'Jenkins', category: 'TOOL', keywords: ['jenkins'] },
  { name: 'PostgreSQL', category: 'TOOL', keywords: ['postgresql', 'postgres'] },
  { name: 'MySQL', category: 'TOOL', keywords: ['mysql'] },
  { name: 'MongoDB', category: 'TOOL', keywords: ['mongodb', 'mongo'] },
  { name: 'Redis', category: 'TOOL', keywords: ['redis'] },
  { name: 'Jest', category: 'TOOL', keywords: ['jest'] },
  { name: 'Cypress', category: 'TOOL', keywords: ['cypress'] },
  { name: 'Linux', category: 'TOOL', keywords: ['linux'] },
  { name: 'Figma', category: 'TOOL', keywords: ['figma'] },
  { name: 'Communication', category: 'SOFT_SKILL', keywords: ['communication'] },
  { name: 'Leadership', category: 'SOFT_SKILL', keywords: ['leadership'] },
  { name: 'Teamwork', category: 'SOFT_SKILL', keywords: ['teamwork', 'team player'] },
  { name: 'Problem solving', category: 'SOFT_SKILL', keywords: ['problem solving', 'problem-solving'] },
  { name: 'Time management', category: 'SOFT_SKILL', keywords: ['time management'] },
  { name: 'Agile', category: 'SOFT_SKILL', keywords: ['agile', 'scrum'] },
];
const COUNTRIES = [
  'jordan', 'uae', 'united arab emirates', 'dubai', 'saudi arabia', 'qatar',
  'egypt', 'lebanon', 'kuwait', 'bahrain', 'oman', 'turkey', 'germany',
  'united kingdom', 'uk', 'usa', 'united states', 'canada', 'france',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text: string, keyword: string): number {
  const needle = keyword.trim();
  const pattern = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'gi');
  return (text.match(pattern) ?? []).length;
}

export class MockAIService implements IAIService {
  readonly name = 'mock:heuristic';

  async analyzeCV(rawText: string): Promise<CvAnalysis> {
    const text = rawText.slice(0, 30_000);
    const lower = text.toLowerCase();

    const skills = SKILL_KEYWORDS.filter((entry) =>
      entry.keywords.some((keyword) => countMatches(lower, keyword) > 0),
    ).map((entry) => {
      const occurrences = Math.max(...entry.keywords.map((k) => countMatches(lower, k)));
      return {
        name: entry.name,
        category: entry.category,
        proficiency: occurrences >= 4 ? 5 : occurrences === 3 ? 4 : occurrences === 2 ? 3 : 2,
        years: null,
      };
    });

    const profile = {
      headline: null as string | null,
      currentTitle: extractCurrentTitle(text),
      summary: extractSummary(text),
      location: extractLocation(text),
      phone: text.match(/(\+?\d[\d\s().-]{7,}\d)(?![\d])/)?.[0]?.trim() ?? null,
      linkedinUrl: extractUrl(text, /linkedin|linkedin\.com|linked\.in/),
      githubUrl: extractUrl(text, /github\.com/),
      portfolioUrl: extractUrl(text, /https?:\/\/[^\s>]+/, { exclude: /linkedin|github\.com/ }),
      yearsOfExperience: extractYearsOfExperience(lower),
    };

    const parsed = cvAnalysisSchema.safeParse({ profile, skills });
    if (!parsed.success) {
      throw new Error('Heuristic extraction failed schema validation');
    }
    return parsed.data;
  }
  async explainMatch(prompt: string): Promise<string> {
    // The mock service returns a deterministic, score-derived explanation so
    // the UI can be tested without a real AI provider.
    const scoreMatch = prompt.match(/Match score:\s*(\d+)/);
    const score = scoreMatch ? Number(scoreMatch[1]) : 50;
    if (score >= 80) {
      return 'You are a strong match for this role — your skills and experience align well with what the employer is looking for.';
    }
    if (score >= 60) {
      return 'You match several key requirements for this role. Highlighting your relevant experience could strengthen your application.';
    }
    if (score >= 40) {
      return 'You have some matching skills, but there are gaps. Consider upskilling in the missing areas to improve your fit.';
    }
        return 'This role may not be the best fit right now, but it highlights skills you could develop for future opportunities.';
  }
}

/** First line that reads like a professional title (up to ~90 chars). */
function extractCurrentTitle(text: string): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const titlePattern =
    /\b(developer|engineer|designer|architect|manager|lead|analyst|consultant|scientist|specialist|administrator|tester|qa|intern|full[- ]stack|front[- ]end|back[- ]end|devops|product)\b/i;
  for (const line of lines.slice(0, 15)) {
    if (line.length <= 90 && titlePattern.test(line) && !line.includes('@')) {
      return line;
    }
  }
  return null;
}

/** First reasonably-sized paragraph (line > 40 chars) after removing URLs/emails. */
function extractSummary(text: string): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const summaryIdx = lines.findIndex((line) => /^(summary|profile|about)/i.test(line));
  const afterHeading = summaryIdx >= 0 ? lines.slice(summaryIdx + 1) : lines;
  const paragraph = afterHeading
    .slice(0, 8)
    .find((line) => line.length > 30 && !/@|https?:/.test(line));
  const fallback = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+@\S+/g, '')
    .split(/\n{2,}/)
    .map((para) => para.replace(/\s+/g, ' ').trim())
    .filter((para) => para.length >= 40)[0];
  return (paragraph ?? fallback ?? '').slice(0, 2000) || null;
}

/** "City, Country" where Country belongs to a known list. */
function extractLocation(original: string): string | null {
  // Flatten line breaks so multi-line addresses still match "City, Country".
  const flattened = original.replace(/\s+/g, ' ').replace(/[,;]\s*[,;]/g, ',');
  for (const country of COUNTRIES) {
    const pattern = new RegExp(`([^,]+),\\s*${country}\\.?`, 'i');
    const match = flattened.match(pattern);
    if (match) {
      const cityWords = match[1].trim().split(/\s+/);
      // Take the word(s) directly before the comma — usually the city.
      const city = cityWords.slice(-1).join(' ').trim();
      const countryPart = match[0]
        .replace(match[1], '')
        .replace(/^,\s*/, '')
        .replace(/[.,;]$/, '');
      return `${city}, ${countryPart}`;
    }
  }
  return null;
}

function extractYearsOfExperience(lower: string): number | null {
  const patterns = [
    /\b(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s+)?experience\b/,
    /\b(?:over|more than)\s+(\d{1,2})\s*(?:years?|yrs?)\b/,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      return Math.min(Number(match[1]), 50);
    }
  }
  return null;
}

function extractUrl(
  text: string,
  test: RegExp,
  options?: { exclude?: RegExp },
): string | null {
  const urls = text.match(/https?:\/\/[\w.-]+(?:\.[\w.-]+)+[^\s>")]*/gi) ?? [];
  for (const url of urls) {
    if (test.test(url) && !(options?.exclude && options.exclude.test(url))) {
      return url.replace(/[,.;:>]$/, '');
    }
  }
  return null;
}