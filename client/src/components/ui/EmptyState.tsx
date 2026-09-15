import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  /** Icon name from the shared inline icon set. */
  icon?: IconName;
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      {icon && (
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </p>
      {message && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
      {children && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>
      )}
    </div>
  );
}
