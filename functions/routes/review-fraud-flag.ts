/**
 * `/review-fraud-flag` — resolve one `fraud_flags` row: `open` → `reviewed` (a
 * human looked at it and it's fine) or `open` → `dismissed` (false positive).
 * `fraud_flags` ships with no client write permission (`scripts/appwrite/schema.ts`
 * — `control()`), so this transition can only happen through this Function.
 */
import type { TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'

const FRAUD_FLAGS_TABLE = 'fraud_flags'

export type FraudFlagReviewStatus = 'reviewed' | 'dismissed'

export interface ReviewFraudFlagInput {
  flagId: string
  status: FraudFlagReviewStatus
}

export interface ReviewFraudFlagOutput {
  id: string
  status: string
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

function isValidStatus(value: unknown): value is FraudFlagReviewStatus {
  return value === 'reviewed' || value === 'dismissed'
}

export async function reviewFraudFlag(
  tablesDB: TablesDB,
  input: ReviewFraudFlagInput,
  caller: string | null,
): Promise<ReviewFraudFlagOutput> {
  const flagId = String(input?.flagId ?? '').trim()
  const status = input?.status

  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  if (!flagId) throw new FnError('validation', 'flagId is required')
  if (!isValidStatus(status)) {
    throw new FnError('validation', 'status must be "reviewed" or "dismissed"')
  }

  let row: Record<string, unknown>
  try {
    row = (await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: FRAUD_FLAGS_TABLE,
      rowId: flagId,
    })) as unknown as Record<string, unknown>
  } catch (e) {
    if (isNotFound(e)) throw new FnError('not_found', `fraud_flags/${flagId} does not exist`)
    throw e
  }

  const currentStatus = String(row.status ?? '')
  if (currentStatus !== 'open') {
    throw new FnError(
      'conflict',
      `fraud_flags/${flagId} is already "${currentStatus}" — only an open flag can be reviewed`,
    )
  }

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: FRAUD_FLAGS_TABLE,
    rowId: flagId,
    data: { status },
  })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'review_fraud_flag',
    entityType: FRAUD_FLAGS_TABLE,
    entityRef: flagId,
    before: { status: 'open' },
    after: { status },
  })

  return { id: flagId, status }
}
