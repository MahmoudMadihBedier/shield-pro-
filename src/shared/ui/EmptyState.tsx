import type { ReactNode } from 'react'

export interface EmptyStateProps {
  /** Arabic-first message. */
  title: string
  description?: string
  /** Optional icon (defaults to a neutral tray glyph). */
  icon?: ReactNode
  /** Optional call-to-action (usually a `<Button>`). */
  action?: ReactNode
  className?: string
}

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M4 13h4l2 3h4l2-3h4M4 13V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6M4 13v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Consistent "nothing here yet" panel for lists, tables and detail sections. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className ?? ''}`}
    >
      <span className="grid size-11 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--text-subtle)]">
        {icon ?? <DefaultIcon />}
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
