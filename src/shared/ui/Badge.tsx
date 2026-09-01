import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
}

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/** Small inline status/label chip. */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className ?? ''}`}
    >
      {children}
    </span>
  )
}

/** Semantic alias — a `Badge` used to render a record's status. */
export const StatusPill = Badge
