import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-black/5 text-[var(--text-muted)] dark:bg-white/10 dark:text-zinc-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
}

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-zinc-400',
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
}

export interface BadgeProps {
  tone?: BadgeTone
  /** Show a small leading status dot. */
  dot?: boolean
  children: ReactNode
  className?: string
}

/** Small inline status/label chip. */
export function Badge({ tone = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className ?? ''}`}
    >
      {dot ? <span className={`size-1.5 rounded-full ${DOT[tone]}`} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Semantic alias — a `Badge` used to render a record's status. */
export const StatusPill = Badge
