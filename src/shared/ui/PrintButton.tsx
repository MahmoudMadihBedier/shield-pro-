import { useCallback } from 'react'

import { Button, type ButtonProps } from './Button'

export interface PrintButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /**
   * Sets `document.title` for the duration of the print dialog so the saved
   * PDF / print job is named sensibly (e.g. the document's reference id).
   * Restored afterwards.
   */
  documentTitle?: string
  label?: string
}

/**
 * "Print / generate bill" — opens the browser print dialog. The app's
 * `@media print` rules strip the chrome so the printout is a clean
 * letterheaded sheet. The button itself is hidden on paper.
 */
export function PrintButton({
  documentTitle,
  label = 'طباعة / Print',
  variant = 'secondary',
  size = 'sm',
  ...rest
}: PrintButtonProps) {
  const onClick = useCallback(() => {
    const previous = document.title
    if (documentTitle) document.title = documentTitle
    const restore = () => {
      document.title = previous
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
    // Safari/Firefox sometimes skip `afterprint` — belt-and-braces.
    window.setTimeout(restore, 1000)
  }, [documentTitle])

  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      onClick={onClick}
      className={`no-print ${rest.className ?? ''}`}
      leadingIcon={
        <svg
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path
            d="M6 7V3h8v4M6 15H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-2M6 12h8v5H6z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      {label}
    </Button>
  )
}
