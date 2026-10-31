import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  api,
  type ActivityReport,
  type ChokepointReport,
  type CutPlan,
  type Models,
  type SimulationRun,
  type VendorReport,
} from '../api/client'
import { useScenarioContext } from './queries'

export type StepStatus = 'idle' | 'running' | 'done' | 'error'
export type LiveStep = {
  id: string
  label: string
  explain: string
  call: string
  status: StepStatus
  ms?: number
  summary?: string
}
export type LiveResults = {
  run?: SimulationRun
  activity?: ActivityReport
  chokepoints?: ChokepointReport
  vendors?: VendorReport
  plan?: Models['RemediationPlan']
  cut?: CutPlan
}

const initial: LiveStep[] = [
  {
    id: 'check',
    label: 'Check the system',
    explain: 'Make sure the server and the Aurora City data are ready.',
    call: 'GET /health',
    status: 'idle',
  },
  {
    id: 'simulate',
    label: 'Find weaknesses and score risk',
    explain:
      'Match each asset to known vulnerabilities, let the AI model rank them, then work out the damage if they fail.',
    call: 'POST /simulation/run',
    status: 'idle',
  },
  {
    id: 'activity',
    label: 'Watch network activity',
    explain:
      'Compare each asset’s traffic with its own normal and flag the odd ones. The traffic is simulated.',
    call: 'GET /activity',
    status: 'idle',
  },
  {
    id: 'weak',
    label: 'Find single points of failure',
    explain: 'Take each asset out alone and see which services stop.',
    call: 'GET /resilience/chokepoints',
    status: 'idle',
  },
  {
    id: 'vendors',
    label: 'Test the supply chain',
    explain: 'Imagine a supplier is hacked and everything it makes fails at once.',
    call: 'GET /resilience/vendors',
    status: 'idle',
  },
  {
    id: 'plan',
    label: 'Plan the best fixes',
    explain:
      'Pick the fixes that cut the most risk for the least effort. Results are estimates, not checked.',
    call: 'POST /actions/optimize',
    status: 'idle',
  },
  {
    id: 'defend',
    label: 'Plan the defence',
    explain:
      'Find how an attacker could get in, and the cheapest set of cuts that blocks every route.',
    call: 'GET /defense/prevention',
    status: 'idle',
  },
  {
    id: 'brief',
    label: 'Write the report',
    explain: 'Everything above is packed into a downloadable brief.',
    call: 'GET /reports/brief',
    status: 'idle',
  },
]

export function useLiveSimulation() {
  const client = useQueryClient()
  const context = useScenarioContext()
  const [steps, setSteps] = useState<LiveStep[]>(initial)
  const [results, setResults] = useState<LiveResults>({})
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const busy = useRef(false)

  const patch = (id: string, change: Partial<LiveStep>) =>
    setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...change } : s)))
  const say = (line: string) =>
    setLog((all) => [...all, `${new Date().toLocaleTimeString([], { hour12: false })}  ${line}`])

  const start = useCallback(async () => {
    if (busy.current || !context.scenario_id) return
    busy.current = true
    setRunning(true)
    setResults({})
    setLog([])
    setSteps(initial)
    const out: LiveResults = {}
    const step = async (id: string, call: string, work: () => Promise<string>) => {
      patch(id, { status: 'running' })
      say(`→ ${call}`)
      const t0 = performance.now()
      try {
        const summary = await work()
        const ms = Math.round(performance.now() - t0)
        patch(id, { status: 'done', ms, summary })
        say(`✓ ${summary} (${(ms / 1000).toFixed(1)} s)`)
        setResults({ ...out })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed'
        patch(id, { status: 'error', ms: Math.round(performance.now() - t0), summary: message })
        say(`✗ ${message}`)
        throw error
      }
    }
    try {
      await step('check', 'GET /health', async () => {
        const h = await api.health()
        return `Server is ${h.status}`
      })
      await step('simulate', 'POST /simulation/run', async () => {
        const run = await api.runSimulation(context)
        out.run = run
        client.setQueryData(['simulation', 'latest'], run)
        for (const s of run.stages) say(`    inside: ${s.name} — ${s.seconds.toFixed(1)} s`)
        const hot = run.assets.filter((a) => a.risk.category === 'critical').length
        return `City risk ${run.city_risk.score?.toFixed(1) ?? 'n/a'} out of 100, ${hot} critical assets`
      })
      await step('activity', 'GET /activity', async () => {
        const a = await api.activity(context)
        out.activity = a
        return `${a.latest.anomalous_assets} of ${a.assets.length} assets look unusual (${a.latest.band})`
      })
      await step('weak', 'GET /resilience/chokepoints', async () => {
        const c = await api.chokepoints(context)
        out.chokepoints = c
        return `${c.chokepoints.filter((x) => x.is_chokepoint).length} assets would stop a service on their own`
      })
      await step('vendors', 'GET /resilience/vendors', async () => {
        const v = await api.vendors(context)
        out.vendors = v
        return `${v.vendors.length} suppliers tested`
      })
      await step('plan', 'POST /actions/optimize', async () => {
        const plan = await api.optimize({
          scenario_id: context.scenario_id,
          snapshot_id: context.snapshot_id ?? '',
          effort_budget_hours: 40,
        })
        out.plan = plan
        return `${plan.steps.length} fixes could take risk from ${plan.starting_city_index.toFixed(1)} to ${plan.ending_city_index.toFixed(1)}`
      })
      await step('defend', 'GET /defense/prevention', async () => {
        const cut = await api.prevention()
        out.cut = cut
        return cut.status === 'cut_found'
          ? `Isolating ${cut.assets.length} assets (${cut.total_hours} h) blocks all ${cut.routes_before} attacker routes`
          : 'No plausible attacker route to a critical asset'
      })
      await step('brief', 'GET /reports/brief', async () => 'Report ready to download')
      for (const key of ['activity', 'asset', 'actions'] as const) {
        void client.invalidateQueries({ queryKey: [key] })
      }
    } catch {
      /* the failing step is already shown */
    } finally {
      busy.current = false
      setRunning(false)
    }
  }, [client, context])

  return { steps, results, running, log, start, context }
}
