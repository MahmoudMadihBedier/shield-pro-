import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Thin modal wrapper around the native `<dialog>` element. RTL- and dark-mode
 * aware; closes on backdrop click and `Escape`.
 */
export function Dialog({
  open,
  title,
  titleEn,
  onClose,
  children,
}: {
  open: boolean
  title: string
  titleEn?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-auto w-[min(44rem,94vw)] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] p-4">
        <h3 className="text-base font-semibold">
          {title}
          {titleEn ? <span className="text-[var(--text-subtle)]"> / {titleEn}</span> : null}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="rounded-lg px-2 py-0.5 text-lg leading-none text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          ×
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
    </dialog>
  )
}
