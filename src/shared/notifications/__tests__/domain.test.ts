import { describe, expect, it } from 'vitest'

import { bilingualKindLabel, notificationKindLabel, notificationRowSchema } from '../domain'

const VALID_ROW = {
  $id: 'notif-1',
  $createdAt: '2026-09-01T09:00:00.000Z',
  $updatedAt: '2026-09-01T09:00:00.000Z',
  recipient_user_id: 'user-1',
  kind: 'fraud_flag',
  title: 'بلاغ احتيال جديد',
  body: 'تفاصيل البلاغ',
  entity_ref: 'p1:w1',
  is_read: false,
  created_at: '2026-09-01T09:00:00.000Z',
}

describe('notificationRowSchema', () => {
  it('accepts a well-formed row', () => {
    expect(notificationRowSchema.safeParse(VALID_ROW).success).toBe(true)
  })

  it('accepts a row with null body and entity_ref', () => {
    const result = notificationRowSchema.safeParse({ ...VALID_ROW, body: null, entity_ref: null })
    expect(result.success).toBe(true)
  })

  it('accepts a kind the label map does not know about yet', () => {
    // `kind` is a free string on the server — new trigger kinds must still parse.
    const result = notificationRowSchema.safeParse({ ...VALID_ROW, kind: 'something_new' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty kind', () => {
    const result = notificationRowSchema.safeParse({ ...VALID_ROW, kind: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing recipient_user_id', () => {
    const { recipient_user_id: _drop, ...rest } = VALID_ROW
    const result = notificationRowSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('defaults is_read to false when omitted', () => {
    const { is_read: _drop, ...rest } = VALID_ROW
    const result = notificationRowSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.is_read).toBe(false)
  })
})

describe('notificationKindLabel / bilingualKindLabel', () => {
  it('resolves a known kind', () => {
    expect(notificationKindLabel('fraud_flag')).toEqual({ ar: 'بلاغ احتيال', en: 'Fraud flag' })
  })

  it('falls back to a generic label for an unknown kind', () => {
    expect(notificationKindLabel('made_up_kind')).toEqual({ ar: 'إشعار', en: 'Notification' })
  })

  it('renders a bilingual string', () => {
    expect(bilingualKindLabel('approval_pending')).toBe('طلب موافقة معلّق / Approval pending')
  })
})
