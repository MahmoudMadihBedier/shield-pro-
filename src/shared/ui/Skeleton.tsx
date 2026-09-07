export interface SkeletonProps {
  className?: string
  /** Render N stacked lines instead of a single block. */
  lines?: number
}

/** Content placeholder with a subtle shimmer. Presentation only. */
export function Skeleton({ className, lines }: SkeletonProps) {
  const base =
    'relative overflow-hidden rounded-md bg-[var(--surface-hover)] ' +
    'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] ' +
    'before:bg-gradient-to-r before:from-transparent before:via-black/5 before:to-transparent ' +
    'dark:before:via-white/10'

  if (lines && lines > 1) {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${base} h-3.5`}
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    )
  }
  return <div className={`${base} h-4 ${className ?? ''}`} />
}
