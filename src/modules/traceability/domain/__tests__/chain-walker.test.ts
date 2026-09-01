import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  linearize,
  walkChain,
  type ChainNode,
  type ResolveNode,
} from '../chain-walker'

/** Build a fake resolver from a fixed map of nodes. */
function fakeResolver(nodes: Record<string, ChainNode>): ResolveNode {
  return (refId) => Promise.resolve(nodes[refId] ?? null)
}

function node(refId: string, patch: Partial<ChainNode> = {}): ChainNode {
  return {
    refId,
    entityType: patch.entityType ?? 'sales_invoices',
    parents: patch.parents ?? [],
    children: patch.children ?? [],
    docStatus: patch.docStatus,
    createdAt: patch.createdAt,
  }
}

describe('walkChain', () => {
  it('walks a linear chain end to end in both directions', async () => {
    const nodes: Record<string, ChainNode> = {
      'PO-2026-00001': node('PO-2026-00001', { children: ['BATCH-2026-00005'] }),
      'BATCH-2026-00005': node('BATCH-2026-00005', {
        parents: ['PO-2026-00001'],
        children: ['TRF-2026-00011'],
      }),
      'TRF-2026-00011': node('TRF-2026-00011', {
        parents: ['BATCH-2026-00005'],
        children: ['INV-2026-00044'],
      }),
      'INV-2026-00044': node('INV-2026-00044', {
        parents: ['TRF-2026-00011'],
        children: ['REC-2026-00051'],
      }),
      'REC-2026-00051': node('REC-2026-00051', { parents: ['INV-2026-00044'] }),
    }

    // Start from the middle so both directions are exercised.
    const graph = await walkChain('TRF-2026-00011', fakeResolver(nodes))

    expect(graph.root).toBe('TRF-2026-00011')
    expect(graph.truncated).toBe(false)
    expect(Object.keys(graph.nodes).sort()).toEqual(Object.keys(nodes).sort())
  })

  it('resolves each reachable node exactly once (diamond / shared parent)', async () => {
    const nodes: Record<string, ChainNode> = {
      'PO-2026-00001': node('PO-2026-00001', {
        children: ['BATCH-2026-00005', 'BATCH-2026-00006'],
      }),
      'BATCH-2026-00005': node('BATCH-2026-00005', { parents: ['PO-2026-00001'] }),
      'BATCH-2026-00006': node('BATCH-2026-00006', { parents: ['PO-2026-00001'] }),
    }
    const resolve = vi.fn(fakeResolver(nodes))

    const graph = await walkChain('PO-2026-00001', resolve)

    expect(Object.keys(graph.nodes).sort()).toEqual([
      'BATCH-2026-00005',
      'BATCH-2026-00006',
      'PO-2026-00001',
    ])
    expect(resolve).toHaveBeenCalledTimes(3)
  })

  it('branches to multiple children from one parent', async () => {
    const nodes: Record<string, ChainNode> = {
      'PO-2026-00001': node('PO-2026-00001', {
        entityType: 'purchase_orders',
        children: ['BATCH-2026-00005', 'BATCH-2026-00006'],
      }),
      'BATCH-2026-00005': node('BATCH-2026-00005', { parents: ['PO-2026-00001'] }),
      'BATCH-2026-00006': node('BATCH-2026-00006', { parents: ['PO-2026-00001'] }),
    }

    const graph = await walkChain('PO-2026-00001', fakeResolver(nodes))

    expect(graph.nodes['PO-2026-00001']?.children).toHaveLength(2)
    expect(Object.keys(graph.nodes)).toHaveLength(3)
    expect(graph.truncated).toBe(false)
  })

  it('terminates on an amendment cycle (amended_from back-edge)', async () => {
    const nodes: Record<string, ChainNode> = {
      'INV-2026-00001': node('INV-2026-00001', { children: ['INV-2026-00002'] }),
      // The amendment points back at the original, and the original lists it as a child.
      'INV-2026-00002': node('INV-2026-00002', {
        parents: ['INV-2026-00001'],
        children: ['INV-2026-00001'],
      }),
    }
    const resolve = vi.fn(fakeResolver(nodes))

    const graph = await walkChain('INV-2026-00001', resolve)

    expect(Object.keys(graph.nodes).sort()).toEqual(['INV-2026-00001', 'INV-2026-00002'])
    expect(graph.truncated).toBe(false)
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('marks the graph truncated when maxNodes is exceeded', async () => {
    // A 50-long linear chain, each node linking to the next.
    const nodes: Record<string, ChainNode> = {}
    for (let i = 1; i <= 50; i += 1) {
      const ref = `INV-2026-${String(i).padStart(5, '0')}`
      const nextRef = `INV-2026-${String(i + 1).padStart(5, '0')}`
      nodes[ref] = node(ref, {
        parents: i > 1 ? [`INV-2026-${String(i - 1).padStart(5, '0')}`] : [],
        children: i < 50 ? [nextRef] : [],
      })
    }

    const graph = await walkChain('INV-2026-00001', fakeResolver(nodes), { maxNodes: 10 })

    expect(graph.truncated).toBe(true)
    expect(Object.keys(graph.nodes).length).toBeLessThanOrEqual(10)
  })

  it('marks the graph truncated when maxDepth is exceeded', async () => {
    const nodes: Record<string, ChainNode> = {}
    for (let i = 1; i <= 20; i += 1) {
      const ref = `INV-2026-${String(i).padStart(5, '0')}`
      nodes[ref] = node(ref, {
        parents: i > 1 ? [`INV-2026-${String(i - 1).padStart(5, '0')}`] : [],
        children: i < 20 ? [`INV-2026-${String(i + 1).padStart(5, '0')}`] : [],
      })
    }

    const graph = await walkChain('INV-2026-00001', fakeResolver(nodes), { maxDepth: 3 })

    expect(graph.truncated).toBe(true)
    expect(Object.keys(graph.nodes).length).toBeLessThan(20)
  })

  it('returns an empty node map for an unresolvable root', async () => {
    const graph = await walkChain('INV-2026-99999', fakeResolver({}))

    expect(graph.root).toBe('INV-2026-99999')
    expect(graph.nodes).toEqual({})
    expect(graph.truncated).toBe(false)
  })

  it('exposes sane defaults', () => {
    expect(DEFAULT_MAX_NODES).toBe(200)
    expect(DEFAULT_MAX_DEPTH).toBe(25)
  })
})

describe('linearize', () => {
  const nodes: Record<string, ChainNode> = {
    'PO-2026-00001': node('PO-2026-00001', { children: ['BATCH-2026-00005'] }),
    'BATCH-2026-00005': node('BATCH-2026-00005', {
      parents: ['PO-2026-00001'],
      children: ['INV-2026-00044'],
    }),
    'INV-2026-00044': node('INV-2026-00044', {
      parents: ['BATCH-2026-00005'],
      children: ['REC-2026-00051'],
    }),
    'REC-2026-00051': node('REC-2026-00051', { parents: ['INV-2026-00044'] }),
  }
  const graph = { root: 'INV-2026-00044', nodes, truncated: false }

  it('lists ancestors nearest-first, excluding the start node', () => {
    expect(linearize(graph, 'ancestors', 'INV-2026-00044')).toEqual([
      'BATCH-2026-00005',
      'PO-2026-00001',
    ])
  })

  it('lists descendants nearest-first, excluding the start node', () => {
    expect(linearize(graph, 'descendants', 'INV-2026-00044')).toEqual(['REC-2026-00051'])
  })

  it('returns nothing for a leaf in the requested direction', () => {
    expect(linearize(graph, 'ancestors', 'PO-2026-00001')).toEqual([])
    expect(linearize(graph, 'descendants', 'REC-2026-00051')).toEqual([])
  })
})
