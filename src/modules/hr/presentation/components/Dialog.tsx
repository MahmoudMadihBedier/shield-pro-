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
      className="m-auto w-[min(32rem,92vw)] rounded-2xl border border-black/10 bg-white p-0 text-zinc-900 backdrop:bg-black/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4 dark:border-white/10">
        <h3 className="text-base font-semibold">
          {title}
          {titleEn ? <span className="text-zinc-400"> / {titleEn}</span> : null}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="rounded-lg px-2 py-0.5 text-lg leading-none text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ×
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
    </dialog>
  )
}
