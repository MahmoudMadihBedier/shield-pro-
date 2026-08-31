/**
 * Phase 1 · Story 1.0 — idempotent Appwrite provisioner.
 *
 * Creates (or leaves untouched) the `shield_pro` database, every table, column,
 * index and RBAC team defined in `schema.ts`, then seeds the naming-series
 * counters. Safe to run repeatedly.
 *
 * Usage:
 *   1. Put an Appwrite API key (scopes: databases.*, tables.*, collections.*,
 *      attributes.*, indexes.*, documents.*, teams.*) in `.env.local`:
 *        APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
 *        APPWRITE_PROJECT_ID="6a95b631003d4163dc97"
 *        APPWRITE_API_KEY="<server key>"
 *   2. pnpm provision            # apply
 *      pnpm provision --dry-run  # print the plan, change nothing
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import { Client, Databases, Query, TablesDB, TablesDBIndexType, Teams } from 'node-appwrite'

import { DATABASE, TABLES, TEAMS, type Column, type Index, type TableDef } from './schema'
import { Tables } from '../../src/infrastructure/appwrite/collections'
import { REFERENCE_PREFIXES } from '../../src/core/reference-id'

// --- env -------------------------------------------------------------------

function loadEnvLocal(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), 'utf8')
      for (const line of text.split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!m) continue
        const key = m[1]!
        let value = m[2]!.trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = value
      }
    } catch {
      /* file may not exist — fine */
    }
  }
}

loadEnvLocal()

const DRY_RUN = process.argv.includes('--dry-run')

const ENDPOINT =
  process.env.APPWRITE_ENDPOINT ??
  process.env.VITE_APPWRITE_ENDPOINT ??
  'https://fra.cloud.appwrite.io/v1'
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? ''
const API_KEY = process.env.APPWRITE_API_KEY ?? ''

if (!PROJECT_ID) fail('APPWRITE_PROJECT_ID is not set')
if (!API_KEY && !DRY_RUN)
  fail('APPWRITE_API_KEY is not set (needed for a real run; use --dry-run to preview)')

// --- clients -------------------------------------------------------------

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID)
if (API_KEY) client.setKey(API_KEY)

const databases = new Databases(client)
const tablesDB = new TablesDB(client)
const teams = new Teams(client)

// --- logging -----------------------------------------------------------

let created = 0
let skipped = 0

function log(icon: string, msg: string): void {
  console.log(`${icon} ${msg}`)
}
function madeIt(msg: string): void {
  created += 1
  log('  +', msg)
}
function already(msg: string): void {
  skipped += 1
  log('  ·', msg)
}
function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}
function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}
function isConflict(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 409
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// --- steps ------------------------------------------------------------------

async function ensureTeams(): Promise<void> {
  log('\n▸', 'RBAC teams')
  for (const team of TEAMS) {
    if (DRY_RUN) {
      madeIt(`team ${team.id} (would create if missing)`)
      continue
    }
    try {
      await teams.get({ teamId: team.id })
      already(`team ${team.id}`)
    } catch (e) {
      if (!isNotFound(e)) throw e
      await teams.create({ teamId: team.id, name: team.name })
      madeIt(`team ${team.id}`)
    }
  }
}

async function ensureDatabase(): Promise<void> {
  log('\n▸', `database "${DATABASE.id}"`)
  if (DRY_RUN) {
    madeIt(`database ${DATABASE.id} (would create if missing)`)
    return
  }
  try {
    await databases.get({ databaseId: DATABASE.id })
    already(`database ${DATABASE.id}`)
  } catch (e) {
    if (!isNotFound(e)) throw e
    await tablesDB.create({ databaseId: DATABASE.id, name: DATABASE.name })
    madeIt(`database ${DATABASE.id}`)
  }
}

async function ensureTable(def: TableDef): Promise<void> {
  if (DRY_RUN) {
    madeIt(`table ${def.id} (would create if missing)`)
    return
  }
  try {
    await tablesDB.getTable({ databaseId: DATABASE.id, tableId: def.id })
    already(`table ${def.id}`)
  } catch (e) {
    if (!isNotFound(e)) throw e
    await tablesDB.createTable({
      databaseId: DATABASE.id,
      tableId: def.id,
      name: def.name,
      permissions: def.permissions,
      rowSecurity: def.rowSecurity,
    })
    madeIt(`table ${def.id}`)
  }
}

async function existingColumnKeys(tableId: string): Promise<Set<string>> {
  if (DRY_RUN) return new Set()
  const out = new Set<string>()
  const res = await tablesDB.listColumns({
    databaseId: DATABASE.id,
    tableId,
    queries: [Query.limit(500)],
  })
  for (const col of res.columns as Array<{ key: string }>) out.add(col.key)
  return out
}

async function createColumn(tableId: string, col: Column): Promise<void> {
  const base = { databaseId: DATABASE.id, tableId, key: col.key }
  switch (col.type) {
    case 'string':
      await tablesDB.createStringColumn({
        ...base,
        size: col.size,
        required: col.required ?? false,
        xdefault: col.required ? undefined : col.default,
        array: col.array ?? false,
      })
      break
    case 'enum':
      await tablesDB.createEnumColumn({
        ...base,
        elements: col.elements,
        required: col.required ?? false,
        xdefault: col.required ? undefined : col.default,
      })
      break
    case 'integer':
      await tablesDB.createIntegerColumn({
        ...base,
        required: col.required ?? false,
        min: col.min,
        max: col.max,
        xdefault: col.required ? undefined : col.default,
      })
      break
    case 'float':
      await tablesDB.createFloatColumn({
        ...base,
        required: col.required ?? false,
        min: col.min,
        max: col.max,
        xdefault: col.required ? undefined : col.default,
      })
      break
    case 'boolean':
      await tablesDB.createBooleanColumn({
        ...base,
        required: col.required ?? false,
        xdefault: col.required ? undefined : col.default,
      })
      break
    case 'datetime':
      await tablesDB.createDatetimeColumn({
        ...base,
        required: col.required ?? false,
      })
      break
  }
}

async function ensureColumns(def: TableDef): Promise<void> {
  const have = await existingColumnKeys(def.id)
  for (const col of def.columns) {
    if (have.has(col.key)) {
      already(`  ${def.id}.${col.key}`)
      continue
    }
    if (DRY_RUN) {
      madeIt(`  ${def.id}.${col.key} : ${col.type} (dry-run)`)
      continue
    }
    try {
      await createColumn(def.id, col)
      madeIt(`  ${def.id}.${col.key} : ${col.type}`)
    } catch (e) {
      if (isConflict(e)) {
        already(`  ${def.id}.${col.key}`)
        continue
      }
      throw e
    }
  }
}

async function waitForColumnsAvailable(tableId: string): Promise<void> {
  if (DRY_RUN) return
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const res = await tablesDB.listColumns({
      databaseId: DATABASE.id,
      tableId,
      queries: [Query.limit(500)],
    })
    const pending = (res.columns as Array<{ key: string; status: string }>).filter(
      (c) => c.status !== 'available',
    )
    if (pending.length === 0) return
    await sleep(1000)
  }
  throw new Error(`columns for ${tableId} never became available`)
}

async function ensureIndexes(def: TableDef): Promise<void> {
  if (def.indexes.length === 0) return
  const have = new Set<string>()
  if (!DRY_RUN) {
    const res = await tablesDB.listIndexes({
      databaseId: DATABASE.id,
      tableId: def.id,
      queries: [Query.limit(500)],
    })
    for (const idx of res.indexes as Array<{ key: string }>) have.add(idx.key)
  }
  for (const idx of def.indexes as Index[]) {
    if (have.has(idx.key)) {
      already(`  ${def.id} index ${idx.key}`)
      continue
    }
    if (DRY_RUN) {
      madeIt(`  ${def.id} index ${idx.key} (${idx.type}) (dry-run)`)
      continue
    }
    try {
      await tablesDB.createIndex({
        databaseId: DATABASE.id,
        tableId: def.id,
        key: idx.key,
        type: idx.type === 'unique' ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
        columns: idx.columns,
      })
      madeIt(`  ${def.id} index ${idx.key} (${idx.type})`)
    } catch (e) {
      if (isConflict(e)) {
        already(`  ${def.id} index ${idx.key}`)
        continue
      }
      throw e
    }
  }
}

async function seedNamingCounters(): Promise<void> {
  log('\n▸', 'naming-series counters')
  const year = new Date().getUTCFullYear()
  for (const prefix of Object.values(REFERENCE_PREFIXES)) {
    const rowId = `${prefix}-${year}`
    if (DRY_RUN) {
      madeIt(`counter ${rowId} (dry-run)`)
      continue
    }
    try {
      await tablesDB.getRow({ databaseId: DATABASE.id, tableId: Tables.namingSeries, rowId })
      already(`counter ${rowId}`)
    } catch (e) {
      if (!isNotFound(e)) throw e
      await tablesDB.createRow({
        databaseId: DATABASE.id,
        tableId: Tables.namingSeries,
        rowId,
        data: { prefix, year, next_value: 1 },
      })
      madeIt(`counter ${rowId}`)
    }
  }
}

// --- run ------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `Shield Pro Appwrite provisioner${DRY_RUN ? ' (DRY RUN — no changes)' : ''}\n` +
      `  endpoint : ${ENDPOINT}\n  project  : ${PROJECT_ID}\n  tables   : ${TABLES.length}`,
  )

  await ensureTeams()
  await ensureDatabase()

  log('\n▸', 'tables, columns, indexes')
  for (const def of TABLES) {
    await ensureTable(def)
    await ensureColumns(def)
    await waitForColumnsAvailable(def.id)
    await ensureIndexes(def)
  }

  await seedNamingCounters()

  console.log(
    `\n✓ done — ${created} created, ${skipped} already present` + (DRY_RUN ? ' (dry run)' : ''),
  )
}

main().catch((e: unknown) => {
  const detail =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e)
  fail(detail)
})
