export interface SpinnerProps {
  /** Tailwind size class, e.g. `size-4` (default) or `size-6`. */
  className?: string
  /** Accessible label; omit to mark purely decorative. */
  label?: string
}

/** Indeterminate loading spinner. */
export function Spinner({ className = 'size-4', label }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`animate-spin text-brand-600 dark:text-brand-400 ${className}`}
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
