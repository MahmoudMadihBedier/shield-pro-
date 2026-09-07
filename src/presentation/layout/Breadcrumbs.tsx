/**
 * Route breadcrumbs derived from the current path + the nav label map. Pure
 * presentation — no data fetching. Unknown segments that look like record ids
 * are shortened; everything else is title-cased.
 */
import { Fragment, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { NAV_ITEMS } from './nav'

const LABEL_BY_PATH: Map<string, string> = new Map(
  NAV_ITEMS.map((item) => [item.to.replace(/\/$/, ''), item.label]),
)

// A record id: a long hex/uuid blob, or a run of 3+ digits. Hyphenated word
// slugs like `purchase-orders` must NOT match — they get title-cased instead.
const ID_LIKE = /^[0-9a-f]{8,}(-[0-9a-f]+)*$|^\d{3,}$/i

function humanize(segment: string): string {
  if (ID_LIKE.test(segment)) {
    return segment.length > 10 ? `#${segment.slice(0, 6)}…` : `#${segment}`
  }
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Crumb {
  label: string
  to: string
}

export function Breadcrumbs() {
  const { pathname } = useLocation()

  const crumbs = useMemo<Crumb[]>(() => {
    const segments = pathname.split('/').filter(Boolean)
    const out: Crumb[] = [{ label: 'الرئيسية', to: '/' }]
    let acc = ''
    for (const seg of segments) {
      acc += `/${seg}`
      out.push({ label: LABEL_BY_PATH.get(acc) ?? humanize(seg), to: acc })
    }
    return out
  }, [pathname])

  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label="مسار التنقل"
      className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
    >
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1
        return (
          <Fragment key={crumb.to}>
            {i > 0 ? (
              <span aria-hidden="true" className="text-[var(--text-subtle)] rtl:rotate-180">
                ›
              </span>
            ) : null}
            {last ? (
              <span className="font-medium text-[var(--text)]">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.to}
                className="transition-colors hover:text-brand-600 dark:hover:text-brand-400"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
