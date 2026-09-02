import { describe, expect, it } from 'vitest'

import { canTransition, DocStatus, isImmutable } from '../doc-status'

describe('canTransition', () => {
  it('allows only Draft→Submitted and Submitted→Cancelled', () => {
    expect(canTransition(DocStatus.Draft, DocStatus.Submitted)).toBe(true)
    expect(canTransition(DocStatus.Submitted, DocStatus.Cancelled)).toBe(true)
  })

  it('forbids editing history: no reverse or skip transitions', () => {
    expect(canTransition(DocStatus.Submitted, DocStatus.Draft)).toBe(false)
    expect(canTransition(DocStatus.Cancelled, DocStatus.Draft)).toBe(false)
    expect(canTransition(DocStatus.Cancelled, DocStatus.Submitted)).toBe(false)
    expect(canTransition(DocStatus.Draft, DocStatus.Cancelled)).toBe(false)
  })
})

describe('isImmutable', () => {
  it('treats Submitted and Cancelled docs as immutable', () => {
    expect(isImmutable(DocStatus.Draft)).toBe(false)
    expect(isImmutable(DocStatus.Submitted)).toBe(true)
    expect(isImmutable(DocStatus.Cancelled)).toBe(true)
  })
})
