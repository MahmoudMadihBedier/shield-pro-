import { Logo } from '@/shared/ui'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'

export interface DocumentLetterheadProps {
  /** Optional line under the company name (e.g. branch, address). */
  subtitle?: string
}

/**
 * Company letterhead for a document / bill. Subtle on screen, prominent on a
 * printout — pair it with the `@media print` rules in `index.css` that strip
 * the app chrome so a printed bill leads with the logo.
 */
export function DocumentLetterhead({ subtitle }: DocumentLetterheadProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3 print:mb-6 print:pb-4">
      <Logo className="h-9 print:h-12" invertOnDark={false} />
      <div className="text-end text-xs leading-tight text-[var(--text-muted)] print:text-black">
        <p className="text-sm font-semibold text-[var(--text)] print:text-black">
          {APP_NAME_AR} <span className="font-normal text-[var(--text-subtle)]">/ {APP_NAME}</span>
        </p>
        {subtitle ? <p className="mt-0.5">{subtitle}</p> : null}
      </div>
    </div>
  )
}
