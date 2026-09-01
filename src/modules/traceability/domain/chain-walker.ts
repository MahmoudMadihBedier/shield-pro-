/**
 * Bidirectional traceability walk over the reference-ID chain
 * (`docs/IMPLEMENTATION_PLAN.md` §4.1).
 *
 * Every business document stores the reference id(s) of the record(s) that
 * produced it (`amended_from`, `purchase_order_ref`, `production_request_ref`,
 * `origin_ref`, `invoice_ref`). `walkChain` starts from any reference id and
 * fans out along BOTH directions — parents (what produced this) and children
 * (what this produced) — until it has the whole connected sub-graph or it hits
 * a bound.
 *
 * The graph is built by BFS with a visited set, so amendment cycles
 * (`A.amended_from = B`, `B` lists `A` as a child) terminate cleanly. Reads are
 * bounded by `maxNodes` / `maxDepth`; hitting either sets `truncated`.
 *
 * `resolve` is injected so this module stays pure (no react, no appwrite) and is
 * fully unit-testable with a fake. The data layer supplies the real resolver.
 *
 * `domain` has ZERO framework imports — plain TypeScript only.
 */

/** A reference id, e.g. `INV-2026-00042`. */
export type ChainNodeRef = string

export interface ChainNode {
  refId: ChainNodeRef
  /** The table / entity the row lives in, e.g. `sales_invoices`. */
  entityType: string
  /** ERPNext-style doc status (0 Draft / 1 Submitted / 2 Cancelled), if known. */
  docStatus?: number
  /** Reference ids of the records that produced this one. */
  parents: ChainNodeRef[]
  /** Reference ids of the records produced from this one. */
  children: ChainNodeRef[]
  /** ISO timestamp the row was created, if known. */
  createdAt?: string
}

export interface ChainGraph {
  root: ChainNodeRef
  nodes: Record<ChainNodeRef, ChainNode>
  /** A `maxNodes` / `maxDepth` bound was reached — the graph is incomplete. */
  truncated: boolean
}

export type ResolveNode = (refId: ChainNodeRef) => Promise<ChainNode | null>

export interface WalkOptions {
  /** Hard cap on resolved nodes. Default 200. */
  maxNodes?: number
  /** Hard cap on BFS distance from the root. Default 25. */
  maxDepth?: number
}

export const DEFAULT_MAX_NODES = 200
export const DEFAULT_MAX_DEPTH = 25

/**
 * Walk the chain outward from `rootRefId` in both directions.
 *
 * An unresolvable root (`resolve` returns `null`) yields a graph with an empty
 * `nodes` map and `truncated: false` — the caller treats "root present, no
 * nodes" as "not found".
 */
export async function walkChain(
  rootRefId: ChainNodeRef,
  resolve: ResolveNode,
  opts: WalkOptions = {},
): Promise<ChainGraph> {
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH

  const nodes: Record<ChainNodeRef, ChainNode> = {}
  let truncated = false

  // `seen` guards against re-queueing (covers cycles + diamonds).
  const seen = new Set<ChainNodeRef>([rootRefId])
  let frontier: ChainNodeRef[] = [rootRefId]
  let depth = 0

  while (frontier.length > 0) {
    if (depth > maxDepth) {
      truncated = true
      break
    }

    const next: ChainNodeRef[] = []

    for (const refId of frontier) {
      if (Object.keys(nodes).length >= maxNodes) {
        truncated = true
        break
      }

      const node = await resolve(refId)
      if (!node) continue

      nodes[refId] = node

      for (const neighbour of [...node.parents, ...node.children]) {
        if (seen.has(neighbour)) continue
        seen.add(neighbour)
        next.push(neighbour)
      }
    }

    if (truncated) break
    frontier = next
    depth += 1
  }

  return { root: rootRefId, nodes, truncated }
}

/**
 * Flatten one direction of the graph starting from `from` (exclusive), nearest
 * first. `ancestors` follows `parents`; `descendants` follows `children`.
 * Cycle-safe; only returns refs that actually resolved into `graph.nodes`.
 */
export function linearize(
  graph: ChainGraph,
  direction: 'ancestors' | 'descendants',
  from: ChainNodeRef,
): ChainNodeRef[] {
  const edge = direction === 'ancestors' ? 'parents' : 'children'
  const ordered: ChainNodeRef[] = []
  const visited = new Set<ChainNodeRef>([from])
  let frontier: ChainNodeRef[] = [from]

  while (frontier.length > 0) {
    const next: ChainNodeRef[] = []
    for (const refId of frontier) {
      const node = graph.nodes[refId]
      if (!node) continue
      for (const neighbour of node[edge]) {
        if (visited.has(neighbour)) continue
        visited.add(neighbour)
        if (graph.nodes[neighbour]) ordered.push(neighbour)
        next.push(neighbour)
      }
    }
    frontier = next
  }

  return ordered
}
