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
  /** 0 = highest-risk part in this run. Drives the order radars pop in. */
  rank: number
  /** Changes with every run so reveal animations replay. */
  runId: string
}

/** Risk per twin part from the latest computed run: the highest-scoring linked asset wins. */
export function useTwinRisk(): {
  run: SimulationRun | null | undefined
  risk: Record<string, TwinRisk>
  error: Error | null
  pending: boolean
  retry: () => unknown
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
        rank: 0,
        runId: run.id,
      }
    }
    Object.values(out)
      .sort((a, b) => b.score - a.score || a.assetId.localeCompare(b.assetId))
      .forEach((entry, index) => (entry.rank = index))
    return out
  }, [run])
  return { run, risk, error: latest.error, pending: latest.isPending, retry: latest.refetch }
}
