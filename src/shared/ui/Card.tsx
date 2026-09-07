import type { HTMLAttributes } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover elevation + pointer affordance (for clickable cards). */
  interactive?: boolean
  /** Drop the default inner padding (e.g. when the card wraps a table). */
  flush?: boolean
}

/** Shared surface container — the app's panel styling, theme-token driven. */
export function Card({ className, interactive = false, flush = false, ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-sm',
        flush ? '' : 'p-5',
        interactive
          ? 'cursor-pointer transition hover:border-[var(--border-strong)] hover:shadow-md'
          : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}
