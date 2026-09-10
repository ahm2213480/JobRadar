import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Optional emoji or glyph shown above the title. */
  icon?: string;
  title: string;
  /** Optional supporting sentence below the title. */
  message?: string;
  /** Optional action buttons/links rendered below the message. */
  children?: ReactNode;
}

/**
 * Reusable empty-state panel for empty lists / no results.
 */
export function EmptyState({ icon, title, message, children }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
      {icon && (
        <p className="text-3xl" aria-hidden="true">
          {icon}
        </p>
      )}
      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {message && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{message}</p>
      )}
      {children && <div className="mt-4 flex justify-center gap-3">{children}</div>}
    </div>
  );
}
