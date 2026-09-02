import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { runInTransaction } from '../transaction'

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>> = {}): TablesDB {
  return {
    createTransaction: vi.fn().mockResolvedValue({ $id: 'txn_1', status: 'pending' }),
    updateTransaction: vi.fn().mockResolvedValue({ $id: 'txn_1' }),
    getRow: vi.fn().mockResolvedValue({ $id: 'r1' }),
    updateRow: vi.fn().mockResolvedValue({ $id: 'r1' }),
    createRow: vi.fn().mockResolvedValue({ $id: 'r2' }),
    ...over,
  } as unknown as TablesDB
}

describe('runInTransaction', () => {
  it('commits after the work resolves and returns its value', async () => {
    const db = fakeDb()
    const out = await runInTransaction(db, async () => 'done')
    expect(out).toBe('done')
    expect(db.createTransaction).toHaveBeenCalledWith({ ttl: 60 })
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'txn_1', commit: true })
    expect(db.updateTransaction).not.toHaveBeenCalledWith(
      expect.objectContaining({ rollback: true }),
    )
  })

  it('rolls back and rethrows when the work throws', async () => {
    const db = fakeDb()
    const boom = new Error('nope')
    await expect(runInTransaction(db, async () => Promise.reject(boom))).rejects.toBe(boom)
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'txn_1', rollback: true })
    expect(db.updateTransaction).not.toHaveBeenCalledWith(expect.objectContaining({ commit: true }))
  })

  it('injects transactionId into every row op the work performs', async () => {
    const db = fakeDb()
    await runInTransaction(db, async (scoped) => {
      await scoped.getRow({ databaseId: 'd', tableId: 't', rowId: 'r' })
      await scoped.updateRow({ databaseId: 'd', tableId: 't', rowId: 'r', data: { x: 1 } })
    })
    expect(db.getRow).toHaveBeenCalledWith({
      databaseId: 'd',
      tableId: 't',
      rowId: 'r',
      transactionId: 'txn_1',
    })
    expect(db.updateRow).toHaveBeenCalledWith({
      databaseId: 'd',
      tableId: 't',
      rowId: 'r',
      data: { x: 1 },
      transactionId: 'txn_1',
    })
  })

  it('raises the caller ttl to the 60s minimum but honours a larger one', async () => {
    const db = fakeDb()
    await runInTransaction(db, async () => null, 10)
    expect(db.createTransaction).toHaveBeenCalledWith({ ttl: 60 })

    const db2 = fakeDb()
    await runInTransaction(db2, async () => null, 120)
    expect(db2.createTransaction).toHaveBeenCalledWith({ ttl: 120 })
  })

  it('still rethrows the original error if rollback itself fails', async () => {
    const db = fakeDb({
      updateTransaction: vi.fn().mockRejectedValue(new Error('rollback failed')),
    })
    const boom = new Error('work failed')
    await expect(runInTransaction(db, async () => Promise.reject(boom))).rejects.toBe(boom)
  })
})
