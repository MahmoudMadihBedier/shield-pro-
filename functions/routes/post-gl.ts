/**
 * `/post-gl` — the ONLY writer of `general_ledger_entries` (Implementation Plan
 * §4.3, Phase 1 Story 1.3).
 *
 * A GL posting must be a valid double entry (`assertBalanced`) and, like every
 * ledger, is append-only: a `voucher_no` already present is a `conflict`, never
 * a re-post. One immutable row is written per line; every call appends to
 * `audit_log`.
 */
import { ID, Query, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { assertBalanced, LedgerError, type GlLine } from '@/core/ledger'

const GL_TABLE = 'general_ledger_entries'

export interface PostGlInput {
  voucherType: string
  voucherNo: string
  postingDatetime: string
  branchId?: string | null
  lines: GlLine[]
}

export interface PostGlOutput {
  voucherNo: string
  entries: number
}

async function alreadyPosted(tablesDB: TablesDB, voucherNo: string): Promise<boolean> {
  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: GL_TABLE,
    queries: [Query.equal('voucher_no', voucherNo), Query.limit(1)],
  })
  return (found.total ?? found.rows?.length ?? 0) > 0
}

export async function postGl(
  tablesDB: TablesDB,
  input: PostGlInput,
  caller: string | null,
): Promise<PostGlOutput> {
  const voucherType = String(input?.voucherType ?? '').trim()
  const voucherNo = String(input?.voucherNo ?? '').trim()
  const postingDatetime = String(input?.postingDatetime ?? '').trim()
  const branchId = input?.branchId ?? null
  const lines = Array.isArray(input?.lines) ? input.lines : []

  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  if (!voucherType) throw new FnError('validation', 'voucherType is required')
  if (!voucherNo) throw new FnError('validation', 'voucherNo is required')
  if (!postingDatetime) throw new FnError('validation', 'postingDatetime is required')
  if (lines.length === 0) throw new FnError('validation', 'at least one GL line is required')

  try {
    assertBalanced(lines)
  } catch (e) {
    if (e instanceof LedgerError) throw new FnError('validation', e.message)
    throw e
  }

  if (await alreadyPosted(tablesDB, voucherNo)) {
    throw new FnError('conflict', `general ledger already has entries for voucher "${voucherNo}"`)
  }

  for (const line of lines) {
    const account = String(line?.account ?? '').trim()
    if (!account) throw new FnError('validation', 'every GL line needs an account')

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: GL_TABLE,
      rowId: ID.unique(),
      data: {
        voucher_type: voucherType,
        voucher_no: voucherNo,
        account,
        branch_id: branchId,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        posting_datetime: postingDatetime,
        is_cancelled: false,
      },
    })
  }

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'post_gl',
    entityType: GL_TABLE,
    entityRef: voucherNo,
    after: { voucherType, entries: lines.length },
  })

  return { voucherNo, entries: lines.length }
}
