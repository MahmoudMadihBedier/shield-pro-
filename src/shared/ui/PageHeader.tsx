import type { ReactNode } from 'react'

export interface PageHeaderProps {
  /** Arabic-first title. */
  title: string
  /** Optional English gloss, shown muted after the Arabic title. */
  titleEn?: string
  description?: string
  /** Actions rendered at the inline-end of the header (buttons, filters…). */
  actions?: ReactNode
  /** Optional row rendered above the title (e.g. `<Breadcrumbs />`). */
  breadcrumbs?: ReactNode
  /** Optional decorative icon shown before the title. */
  icon?: ReactNode
}

/** Standard page title block. RTL-correct: actions sit at the inline-end. */
export function PageHeader({
  title,
  titleEn,
  description,
  actions,
  breadcrumbs,
  icon,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs ? <div className="mb-2">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">
              {title}
              {titleEn ? (
                <span className="font-normal text-[var(--text-subtle)]"> / {titleEn}</span>
              ) : null}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
