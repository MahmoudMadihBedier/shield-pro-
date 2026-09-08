import { Logo, PrintButton } from '@/shared/ui'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'

export interface DocumentLetterheadProps {
  /** Optional line under the company name (e.g. branch, address). */
  subtitle?: string
  /**
   * The document's reference / number — used to name the printout and shown
   * beside the company block.
   */
  reference?: string
  /** Hide the built-in Print button (rare). */
  hidePrint?: boolean
}

/**
 * Company letterhead + a Print action for a document / bill. Subtle on screen,
 * the top of the sheet on a printout — the `@media print` rules in `index.css`
 * strip the app chrome so a printed page leads with the logo.
 */
export function DocumentLetterhead({ subtitle, reference, hidePrint }: DocumentLetterheadProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3 print:mb-6 print:pb-4">
      {/* white chip so the black line-art stays visible in dark mode too */}
      <span className="inline-flex rounded bg-white px-2 py-1 print:bg-transparent print:p-0">
        <Logo className="h-8 print:h-12" invertOnDark={false} />
      </span>
      <div className="flex items-center gap-3">
        <div className="text-end text-xs leading-tight text-[var(--text-muted)] print:text-black">
          <p className="text-sm font-semibold text-[var(--text)] print:text-black">
            {APP_NAME_AR}{' '}
            <span className="font-normal text-[var(--text-subtle)]">/ {APP_NAME}</span>
          </p>
          {reference ? (
            <p className="mt-0.5 font-mono" dir="ltr">
              {reference}
            </p>
          ) : null}
          {subtitle ? <p className="mt-0.5">{subtitle}</p> : null}
        </div>
        {hidePrint ? null : (
          <PrintButton documentTitle={reference ? `${APP_NAME} · ${reference}` : APP_NAME} />
        )}
      </div>
    </div>
  )
}
