/**
 * Pure post-login redirect rules for `LoginPage` — split out of that file so
 * exporting them (for `LoginPage.test.ts`) doesn't trip `react/only-export-
 * components` (a component file should export only components). No React.
 */

export type LoginMode = 'staff' | 'portal'

/** `/portal` or `/portal/...` — the two identities' redirect targets never overlap otherwise. */
export function isPortalPath(path: string): boolean {
  return path === '/portal' || path.startsWith('/portal/')
}

/**
 * `stateFrom` (set by `RequireAuth`/`RequirePortalAuth` when they bounce an
 * anonymous visitor here) is only honored when it actually belongs to the
 * identity that's logging in — e.g. a portal deep link surviving into a
 * staff login (the visitor flipped the tab after landing here) must not
 * redirect a newly-authenticated staff member into `/portal/...`.
 */
export function resolveFrom(mode: LoginMode, stateFrom: string | undefined): string {
  const wantsPortal = mode === 'portal'
  if (stateFrom && isPortalPath(stateFrom) === wantsPortal) return stateFrom
  return wantsPortal ? '/portal' : '/'
}
