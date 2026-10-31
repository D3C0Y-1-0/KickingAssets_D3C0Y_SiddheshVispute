import { useMemo } from 'react'
import { useLatestRun } from './queries'
import { TWIN_LINKS } from '../data/twinLinks'
import type { AssetSimulation, SimulationRun } from '../api/client'

export type TwinRisk = {
  assetId: string
  name: string
  score: number
  category: AssetSimulation['risk']['category']
  linked: number
}

/** Risk per twin part from the latest computed run: the highest-scoring linked asset wins. */
export function useTwinRisk(): {
  run: SimulationRun | null | undefined
  risk: Record<string, TwinRisk>
} {
  const latest = useLatestRun()
  const run = latest.data
  const risk = useMemo(() => {
    const out: Record<string, TwinRisk> = {}
    if (!run) return out
    const byId = new Map(run.assets.map((a) => [a.asset_id, a]))
    for (const [part, ids] of Object.entries(TWIN_LINKS)) {
      const linked = ids
        .map((id) => byId.get(id))
        .filter((a): a is AssetSimulation => !!a && a.risk.score != null)
      if (!linked.length) continue
      const top = linked.reduce((a, b) => ((b.risk.score ?? 0) > (a.risk.score ?? 0) ? b : a))
      out[part] = {
        assetId: top.asset_id,
        name: top.name,
        score: top.risk.score ?? 0,
        category: top.risk.category,
        linked: linked.length,
      }
    }
    return out
  }, [run])
  return { run, risk }
}
