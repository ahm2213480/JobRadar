import type {
  CvAnalysisResult,
  ExtractedSkill,
  SkillCategory,
} from '../../types/cv';
import { CATEGORY_LABELS } from '../../types/cv';

export function AnalysisPanel({ analysis }: { analysis: CvAnalysisResult }) {
  const profile = analysis.analysis.profile;
  const fields: Array<[string, string]> = [
    ['Current title', profile.currentTitle],
    ['Location', profile.location],
    [
      'Years of experience',
      profile.yearsOfExperience != null ? String(profile.yearsOfExperience) : null,
    ],
    ['Summary', profile.summary],
    ['Phone', profile.phone],
    ['LinkedIn', profile.linkedinUrl],
    ['GitHub', profile.githubUrl],
    ['Portfolio', profile.portfolioUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const groups = groupByCategory(analysis.analysis.skills);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
          Analysis complete
        </h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
          {analysis.provider}
        </span>
      </div>

      <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-100/80">
        {analysis.skills.length} skills saved to your profile. Profile fields
        you had not filled in yet were completed automatically.
      </p>

      {fields.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                {label}
              </dt>
              <dd className="text-sm font-medium text-emerald-950 dark:text-emerald-50">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {groups.length > 0 && (
        <div className="mt-5 border-t border-emerald-200/70 pt-4 dark:border-emerald-900">
          {groups.map(([category, skills]) => (
            <div key={category} className="mb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span
                    key={skill.name}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                  >
                    {skill.name}
                    {skill.proficiency != null && ` · ${'●'.repeat(skill.proficiency)}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByCategory(
  skills: ExtractedSkill[],
): Array<[SkillCategory, ExtractedSkill[]]> {
  const map = new Map<SkillCategory, ExtractedSkill[]>();
  for (const skill of skills) {
    const group = map.get(skill.category) ?? [];
    group.push(skill);
    map.set(skill.category, group);
  }
  return [...map.entries()];
}