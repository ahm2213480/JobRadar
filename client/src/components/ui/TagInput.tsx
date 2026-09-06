import { useState, type KeyboardEvent } from 'react';

interface TagInputProps {
  label: string;
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  max?: number;
}

/**
 * Chip-style list editor for arrays (job titles, locations, technologies).
 * Enter or comma commits the draft; Backspace on an empty draft removes the
 * last item.
 */
export function TagInput({
  label,
  id,
  values,
  onChange,
  placeholder,
  max = 10,
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    if (values.length >= max) return;
    const isDuplicate = values.some(
      (existing) => existing.toLowerCase() === value.toLowerCase(),
    );
    if (isDuplicate) {
      setDraft('');
      return;
    }
    onChange([...values, value]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-300"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={values.length ? '' : placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}
