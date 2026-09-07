import { APP_NAME, APP_NAME_AR } from '@/shared/constants'

/** App logo lockup for the top bar — a shield glyph + the Arabic/EN name. */
export function BrandMark() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" aria-hidden="true">
          <path
            d="M12 2.5 4.5 5.2v6.1c0 4.7 3.2 8.2 7.5 10.2 4.3-2 7.5-5.5 7.5-10.2V5.2L12 2.5Z"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <path
            d="M12 2.5 4.5 5.2v6.1c0 4.7 3.2 8.2 7.5 10.2 4.3-2 7.5-5.5 7.5-10.2V5.2L12 2.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="m8.5 12 2.4 2.4L15.8 9.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="hidden text-sm leading-tight font-bold tracking-tight sm:block">
        {APP_NAME_AR}
        <span className="block text-[10px] font-medium text-[var(--text-subtle)]">{APP_NAME}</span>
      </span>
    </div>
  )
}
