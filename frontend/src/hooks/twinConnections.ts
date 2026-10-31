import { useMemo } from 'react'
import { useGraph } from './queries'
import { TWIN_LINKS } from '../data/twinLinks'
import type { GraphMode } from '../api/client'

/** A relationship between two twin parts, derived from the scenario graphs. */
export type PartLink = {
  id: string
  from: string
  to: string
  kind: GraphMode
  /** operational: "power · required"; cyber: "OPC UA" */
  label: string
  /** The scenario edge(s) behind it, as `SOURCE → TARGET`. */
  via: string[]
}

const isCity = (part: string) => part.startsWith('city-')

const partsOf = new Map<string, string[]>()
for (const [part, ids] of Object.entries(TWIN_LINKS)) {
  for (const id of ids) partsOf.set(id, [...(partsOf.get(id) ?? []), part])
}

/**
 * Part-to-part connections taken from the operational (provider → dependent) and cyber
 * (permitted access path) graphs. Nothing is invented: a part with no mapped asset, or whose
 * assets have no edge to another mapped part, simply has no connection here. The two kinds are
 * kept separate and never merged; a cyber path does not mean anything was compromised.
 */
export function usePartLinks(): PartLink[] {
  const operational = useGraph('operational').data
  const cyber = useGraph('cyber').data
  return useMemo(() => {
    const out = new Map<string, PartLink>()
    const add = (kind: GraphMode, src: string, dst: string, label: string) => {
      for (const a of partsOf.get(src) ?? []) {
        for (const b of partsOf.get(dst) ?? []) {
          // campus-level (city-*) parts only connect to campus-level parts
          if (a === b || isCity(a) !== isCity(b)) continue
          const id = `${kind}:${a}>${b}:${label}`
          const via = `${src} → ${dst}`
          const prior = out.get(id)
          if (prior) {
            if (!prior.via.includes(via)) prior.via.push(via)
          } else out.set(id, { id, from: a, to: b, kind, label, via: [via] })
        }
      }
    }
    for (const e of operational?.edges ?? []) {
      if (e.kind === 'operational')
        add(
          'operational',
          e.source_asset_id,
          e.target_asset_id,
          `${e.dependency} · ${e.requirement}`,
        )
    }
    for (const e of cyber?.edges ?? []) {
      if (e.kind === 'cyber') add('cyber', e.source_asset_id, e.target_asset_id, e.protocol)
    }
    return [...out.values()]
  }, [operational, cyber])
}
