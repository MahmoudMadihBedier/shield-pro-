/**
 * `/fraud-scan` — runs the three fraud heuristics (`@/core/fraud`) over a
 * recent window of `stock_ledger_entries` + `audit_log` and appends any new
 * `fraud_flags` rows (Implementation Plan §4 / Phase 2 Story 2.3).
 *
 * Read-only over the ledgers, one `createRow` per surviving candidate into the
 * control-plane `fraud_flags` table, plus a single audit row for the scan
 * itself. Staff-only — this is not a submittable document, so there is no
 * `canSubmitTable` gate; any authenticated staff member may trigger a scan.
 */
import { ID, Query, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { createNotification, listSystemAdminUserIds } from '../common/notifications'
import {
  dedupeCandidates,
  detectHighReversalRatio,
  detectRepeatedMovement,
  detectRoundTripping,
  type FraudCandidate,
  type LedgerMove,
} from '@/core/fraud'

const STOCK_LEDGER_TABLE = 'stock_ledger_entries'
const AUDIT_LOG_TABLE = 'audit_log'
const FRAUD_FLAGS_TABLE = 'fraud_flags'

/** Column caps from `scripts/appwrite/schema.ts` — `fraud_flags`. */
const SUBJECT_TYPE_MAX = 32
const SUBJECT_ID_MAX = 36
const DETAIL_MAX = 2000

/** Arabic-friendly short label per `FraudCandidate.kind`, for the notification title. */
const FRAUD_KIND_TITLE_AR: Record<string, string> = {
  round_tripping: 'حركة دائرية',
  repeated_movement: 'حركة متكررة',
  high_reversal_ratio: 'نسبة إلغاء مرتفعة',
}

const DEFAULT_LOOKBACK_HOURS = 24
/** Reject anything asking to scan further back than 7 days. */
const MAX_LOOKBACK_HOURS = 168
/** Cap every fetch — a fraud scan reasons over a recent window, not full history. */
const FETCH_LIMIT = 1000

export interface FraudScanInput {
  lookbackHours?: number
}

export interface FraudScanOutput {
  scanned: { moves: number; auditEvents: number }
  flagsCreated: number
  flags: FraudCandidate[]
}

interface ActorCounts {
  submitted: number
  cancelled: number
}

function toLedgerMove(raw: Record<string, unknown>): LedgerMove {
  return {
    voucherType: String(raw.voucher_type ?? ''),
    voucherNo: String(raw.voucher_no ?? ''),
    productId: String(raw.product_id ?? ''),
    warehouseId: String(raw.warehouse_id ?? ''),
    qtyChange: Number(raw.qty_change) || 0,
    postingDatetime: String(raw.posting_datetime ?? ''),
  }
}

function toAuditEvent(raw: Record<string, unknown>): { actorId: string; action: string } {
  return { actorId: String(raw.actor_id ?? ''), action: String(raw.action ?? '') }
}

export async function fraudScan(
  tablesDB: TablesDB,
  input: FraudScanInput,
  caller: string | null,
): Promise<FraudScanOutput> {
  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  const lookbackHours = input?.lookbackHours ?? DEFAULT_LOOKBACK_HOURS
  if (!Number.isFinite(lookbackHours) || lookbackHours <= 0) {
    throw new FnError('validation', 'lookbackHours must be a positive number')
  }
  if (lookbackHours > MAX_LOOKBACK_HOURS) {
    throw new FnError('validation', `lookbackHours cannot exceed ${MAX_LOOKBACK_HOURS} (7 days)`)
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - lookbackHours * 3_600_000).toISOString()

  const [movesResult, auditResult, openFlagsResult] = await Promise.all([
    tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: STOCK_LEDGER_TABLE,
      queries: [Query.greaterThanEqual('posting_datetime', windowStart), Query.limit(FETCH_LIMIT)],
    }),
    tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: AUDIT_LOG_TABLE,
      queries: [Query.greaterThanEqual('created_at', windowStart), Query.limit(FETCH_LIMIT)],
    }),
    tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: FRAUD_FLAGS_TABLE,
      queries: [Query.equal('status', 'open'), Query.limit(FETCH_LIMIT)],
    }),
  ])

  const moves = (movesResult.rows as unknown as Record<string, unknown>[]).map(toLedgerMove)
  const auditEvents = (auditResult.rows as unknown as Record<string, unknown>[]).map(toAuditEvent)
  const openSubjects = (openFlagsResult.rows as unknown as Record<string, unknown>[]).map(
    (row) => ({
      kind: String(row.kind ?? ''),
      subjectId: String(row.subject_id ?? ''),
    }),
  )

  // Per-actor submit/cancel counts, for the reversal-ratio heuristic.
  const actorCounts = new Map<string, ActorCounts>()
  for (const event of auditEvents) {
    if (!event.actorId) continue
    if (event.action !== 'submit' && event.action !== 'cancel') continue
    const counts = actorCounts.get(event.actorId) ?? { submitted: 0, cancelled: 0 }
    if (event.action === 'submit') counts.submitted += 1
    else counts.cancelled += 1
    actorCounts.set(event.actorId, counts)
  }

  const candidates: FraudCandidate[] = [
    ...detectRoundTripping(moves, { windowHours: lookbackHours }),
    ...detectRepeatedMovement(moves, { windowHours: lookbackHours }),
  ]
  for (const [actorId, counts] of actorCounts) {
    const flag = detectHighReversalRatio(actorId, counts.submitted, counts.cancelled)
    if (flag) candidates.push(flag)
  }

  const toCreate = dedupeCandidates(openSubjects, candidates)

  // Fetch the System Admin roster once for the whole batch — calling
  // `notifySystemAdmins` per candidate would re-scan the `users` table once
  // per flag, multiplying reads inside this transaction's TTL window for no
  // benefit once there is more than one new flag.
  const adminIds = toCreate.length > 0 ? await listSystemAdminUserIds(tablesDB) : []

  for (const candidate of toCreate) {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: FRAUD_FLAGS_TABLE,
      rowId: ID.unique(),
      data: {
        kind: candidate.kind,
        subject_type: candidate.subjectType.slice(0, SUBJECT_TYPE_MAX),
        subject_id: candidate.subjectId.slice(0, SUBJECT_ID_MAX),
        detail: candidate.detail.slice(0, DETAIL_MAX),
        status: 'open',
        created_at: now.toISOString(),
      },
    })
    // One notification per surviving candidate (not a single batch summary) —
    // each flag is its own fraud pattern/subject and the System Admin team
    // needs to triage them individually. Swallow-and-log: this whole scan
    // runs inside `runInTransaction` (see `functions/server/src/main.ts`), so
    // an uncaught failure here would roll back the fraud_flags row just
    // written above — a missed notification must never do that.
    for (const recipientUserId of adminIds) {
      try {
        await createNotification(tablesDB, {
          recipientUserId,
          kind: 'fraud_flag',
          title: `بلاغ احتيال جديد: ${FRAUD_KIND_TITLE_AR[candidate.kind] ?? candidate.kind}`,
          body: candidate.detail,
          entityRef: candidate.subjectId,
        })
      } catch (e) {
        console.error(
          `fraud-scan: notification failed for admin ${recipientUserId}:`,
          e instanceof Error ? e.message : String(e),
        )
      }
    }
  }

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'fraud_scan',
    entityType: FRAUD_FLAGS_TABLE,
    entityRef: `scan-${now.toISOString()}`,
    after: { created: toCreate.length },
  })

  return {
    scanned: { moves: moves.length, auditEvents: auditEvents.length },
    flagsCreated: toCreate.length,
    flags: toCreate,
  }
}
