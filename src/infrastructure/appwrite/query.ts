/**
 * `Query` + `ID` — drop-in replacements for the Appwrite SDK's helpers so the
 * ~90 call sites across the modules don't change. `Query.*` returns the exact
 * JSON-string shape Appwrite produced; `tables.ts`'s shim parses those strings
 * and applies them to a Supabase PostgREST query builder.
 */

function enc(method: string, attribute: string | undefined, values: unknown[] | undefined): string {
  const obj: Record<string, unknown> = { method }
  if (attribute !== undefined) obj.attribute = attribute
  if (values !== undefined) obj.values = values
  return JSON.stringify(obj)
}

export const Query = {
  equal: (attribute: string, value: unknown) =>
    enc('equal', attribute, Array.isArray(value) ? value : [value]),
  notEqual: (attribute: string, value: unknown) => enc('notEqual', attribute, [value]),
  lessThan: (attribute: string, value: unknown) => enc('lessThan', attribute, [value]),
  lessThanEqual: (attribute: string, value: unknown) => enc('lessThanEqual', attribute, [value]),
  greaterThan: (attribute: string, value: unknown) => enc('greaterThan', attribute, [value]),
  greaterThanEqual: (attribute: string, value: unknown) =>
    enc('greaterThanEqual', attribute, [value]),
  between: (attribute: string, start: unknown, end: unknown) =>
    enc('between', attribute, [start, end]),
  startsWith: (attribute: string, value: string) => enc('startsWith', attribute, [value]),
  endsWith: (attribute: string, value: string) => enc('endsWith', attribute, [value]),
  contains: (attribute: string, value: unknown) => enc('contains', attribute, [value]),
  search: (attribute: string, value: string) => enc('search', attribute, [value]),
  isNull: (attribute: string) => enc('isNull', attribute, undefined),
  isNotNull: (attribute: string) => enc('isNotNull', attribute, undefined),
  orderAsc: (attribute: string) => enc('orderAsc', attribute, undefined),
  orderDesc: (attribute: string) => enc('orderDesc', attribute, undefined),
  limit: (value: number) => enc('limit', undefined, [value]),
  offset: (value: number) => enc('offset', undefined, [value]),
  cursorAfter: (id: string) => enc('cursorAfter', undefined, [id]),
  cursorBefore: (id: string) => enc('cursorBefore', undefined, [id]),
  select: (attributes: string[]) => enc('select', undefined, attributes),
  or: (queries: string[]) => enc('or', undefined, queries),
  and: (queries: string[]) => enc('and', undefined, queries),
} as const

/** RFC4122 v4 — the client rarely sets its own row id; the DB defaults one. */
export const ID = {
  unique: (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  custom: (id: string): string => id,
} as const

/** Permission / Role were Appwrite value helpers; kept as no-op stubs so any
 *  stray import still type-checks. RLS replaces them entirely. */
export const Permission = {
  read: () => '',
  create: () => '',
  update: () => '',
  delete: () => '',
  write: () => '',
} as const

export const Role = {
  any: () => '',
  users: () => '',
  user: (id: string) => id,
  team: (id: string) => id,
  label: (name: string) => name,
} as const
