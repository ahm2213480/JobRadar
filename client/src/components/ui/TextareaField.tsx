import type { TextareaHTMLAttributes } from 'react';

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
}

export function TextareaField({ label, id, ...textareaProps }: TextareaFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <textarea
        id={id}
        {...textareaProps}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900"
      />
    </div>
  );
}
