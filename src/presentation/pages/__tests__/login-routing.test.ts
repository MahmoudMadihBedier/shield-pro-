import { describe, expect, it } from 'vitest'

import { isPortalPath, resolveFrom } from '../login-routing'

describe('isPortalPath', () => {
  it('matches /portal and any /portal/... path', () => {
    expect(isPortalPath('/portal')).toBe(true)
    expect(isPortalPath('/portal/statement')).toBe(true)
    expect(isPortalPath('/portal/invoices/1')).toBe(true)
  })

  it('rejects a staff path, including one that merely starts with the substring', () => {
    expect(isPortalPath('/admin/customers/1')).toBe(false)
    expect(isPortalPath('/portals-are-not-a-real-route')).toBe(false)
  })
})

describe('resolveFrom', () => {
  it('uses the mode-appropriate default when there is no stateFrom', () => {
    expect(resolveFrom('staff', undefined)).toBe('/')
    expect(resolveFrom('portal', undefined)).toBe('/portal')
  })

  it('honors stateFrom when it matches the logging-in identity', () => {
    expect(resolveFrom('staff', '/admin/customers/1')).toBe('/admin/customers/1')
    expect(resolveFrom('portal', '/portal/statement')).toBe('/portal/statement')
  })

  it('falls back to the mode default when stateFrom belongs to the other identity', () => {
    // A portal deep link survives into the location state, but the visitor
    // flipped the tab and logged in as staff instead — must not land them
    // inside /portal/...
    expect(resolveFrom('staff', '/portal/statement')).toBe('/')
    // And the reverse: a staff deep link surviving into a portal login.
    expect(resolveFrom('portal', '/admin/customers/1')).toBe('/portal')
  })
})
