/**
 * Data layer for `supplier_contacts` — a real one-to-many child table (one
 * supplier, many contact people), not a JSON blob column. Deliberately a
 * bespoke repo rather than `makeMasterRepo`: every operation is scoped to one
 * `supplier_id`, which the generic factory has no notion of.
 *
 * Contract (`claude.md` B.5): catch raw Appwrite errors → typed `AppError`;
 * Zod-parse every row; return `Result<T, AppError>` — never throw across the
 * boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

import {
  supplierContactInputSchema,
  supplierContactRowSchema,
  type SupplierContact,
  type SupplierContactInput,
} from '../domain/schemas'

const SHAPE_ERROR = 'تعذّر قراءة جهة اتصال المورد — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'
/** A supplier realistically has a handful of contacts — no pagination UI. */
const MAX_CONTACTS = 100

function parseRow(raw: unknown): Result<SupplierContact> {
  const parsed = supplierContactRowSchema.safeParse(raw)
  if (!parsed.success) {
    return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
  }
  return ok(parsed.data)
}

export async function listSupplierContacts(supplierId: string): Promise<Result<SupplierContact[]>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.supplierContacts,
      queries: [
        Query.equal('supplier_id', supplierId),
        Query.orderDesc('is_primary'),
        Query.limit(MAX_CONTACTS),
      ],
    })
    const rows: SupplierContact[] = []
    for (const raw of res.rows) {
      const parsed = parseRow(raw)
      if (!parsed.ok) return parsed
      rows.push(parsed.value)
    }
    return ok(rows)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export async function createSupplierContact(
  supplierId: string,
  input: SupplierContactInput,
): Promise<Result<SupplierContact>> {
  const parsedInput = supplierContactInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return err(
      appError('validation', 'بيانات جهة الاتصال غير صالحة.', {
        detail: parsedInput.error.message,
      }),
    )
  }
  try {
    const row = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: Tables.supplierContacts,
      rowId: ID.unique(),
      data: { ...parsedInput.data, supplier_id: supplierId },
    })
    return parseRow(row)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export async function removeSupplierContact(id: string): Promise<Result<void>> {
  try {
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: Tables.supplierContacts,
      rowId: id,
    })
    return ok(undefined)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
