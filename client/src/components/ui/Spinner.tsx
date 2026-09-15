interface SpinnerProps {
  className?: string;
}

/** Small inline loading spinner (inherits currentColor). */
export function Spinner({ className = 'h-5 w-5' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin text-slate-400 dark:text-slate-500 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
