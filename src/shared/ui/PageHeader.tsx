import type { ReactNode } from 'react'

export interface PageHeaderProps {
  /** Arabic-first title. */
  title: string
  /** Optional English gloss, shown muted after the Arabic title. */
  titleEn?: string
  description?: string
  /** Actions rendered at the inline-end of the header (buttons, filters…). */
  actions?: ReactNode
}

/** Standard page title block. RTL-correct: actions sit at the inline-end. */
export function PageHeader({ title, titleEn, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">
          {title}
          {titleEn ? <span className="text-zinc-400"> / {titleEn}</span> : null}
        </h2>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
