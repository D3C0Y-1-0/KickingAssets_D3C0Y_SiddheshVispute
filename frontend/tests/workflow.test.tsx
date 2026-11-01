// @vitest-environment jsdom
// Test-only numerical fixtures exercise UI states; production always calls the backend.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api, type Asset, type Models, type SimulationRun } from '../src/api/client'
import Remediation from '../src/features/remediation/Remediation'
import WhatIf from '../src/features/whatif/WhatIf'
import {
  actionNames,
  makeHandoff,
  readHandoff,
  relativeChange,
  validateActions,
  validateBudget,
  validateExclusions,
  selectPlanRequest,
  binding,
} from '../src/features/actions/workflow'
import { checkBaseline } from '../src/features/actions/useActionWorkflow'

const context = { scenario_id: 'test-city', snapshot_id: 'test-snapshot' }
const assets = [
  { id: 'A', name: 'Test gateway', site: 'North', ...context },
  { id: 'B', name: 'Test controller', site: 'South', ...context },
] as Asset[]
const run = {
  ...context,
  id: 'test-run',
  fingerprint: 'test-fingerprint-0123456789',
  created_at: '2026-10-31T10:00:00Z',
  as_of: '2026-10-01',
  city_risk: { score: 40 },
  assets: assets.map((asset) => ({
    asset_id: asset.id,
    name: asset.name,
    sector: 'power',
    risk: { score: 80, category: 'critical' },
    vulnerability_signal: 0.8,
    exposure_factor: 1,
    impact_factor: 1,
  })),
} as SimulationRun
const steps: Models['PlanStep'][] = [
  {
    rank: 1,
    kind: 'selected',
    downtime_hours: 2,
    reduction_per_effort_hour: 1,
    asset_id: 'A',
    asset_name: 'Test gateway',
    action_type: 'patch_prioritization',
    name: 'Patch prioritization',
    effort_hours: 8,
    marginal_reduction: 8,
    cumulative_reduction: 8,
    city_index_after: 32,
    justification: 'Test fixture',
    operational_disruption: 'Maintenance assumed',
  },
  {
    rank: 2,
    kind: 'selected',
    downtime_hours: 1,
    reduction_per_effort_hour: 0.1667,
    asset_id: 'B',
    asset_name: 'Test controller',
    action_type: 'access_control',
    name: 'Access-control improvement',
    effort_hours: 12,
    marginal_reduction: 2,
    cumulative_reduction: 10,
    city_index_after: 30,
    justification: 'Test fixture',
    operational_disruption: 'Enrollment assumed',
  },
]
const plan: Models['RemediationPlan'] = {
  ...context,
  run_id: run.id,
  baseline_fingerprint: run.fingerprint,
  optimality: 'greedy_heuristic',
  used_downtime_hours: 3,
  rejected: [],
  limitations: ['Test heuristic limitation'],
  what_if_request: {
    ...context,
    run_id: run.id,
    baseline_fingerprint: run.fingerprint,
    constraints: null,
    actions: steps.map(({ asset_id, action_type }) => ({ asset_id, action_type })),
  },
  state: 'projected',
  verification: 'not_verified',
  effort_budget_hours: 60,
  used_hours: 20,
  starting_city_index: 40,
  ending_city_index: 30,
  steps,
  recommendation_only: [],
  method: 'Test greedy plan',
}
const options: Models['ActionOption'][] = assets.flatMap((asset) =>
  Object.entries(actionNames).map(([type, name]) => ({
    asset_id: asset.id,
    asset_name: asset.name,
    action_type: type as Models['ActionOption']['action_type'],
    name,
    applicable: true,
    modelled: true,
    effort_hours: type === 'access_control' ? 12 : 8,
    projected_asset_score: 60,
    asset_reduction: 20,
    city_reduction: 10,
    justification: 'Test fixture',
    operational_disruption: 'Assumed',
  })),
)
const projection: Models['WhatIfResult'] = {
  ...context,
  run_id: run.id,
  baseline_fingerprint: run.fingerprint,
  summary: {
    current_city_index: 40,
    projected_city_index: 30,
    city_reduction: 10,
    current_category_counts: [],
    projected_category_counts: [],
    overlap_adjustment: 0,
  },
  constraint_report: {
    total_effort_hours: 8,
    total_downtime_hours: 2,
    constraints_supplied: false,
    checks: [],
  },
  state: 'projected',
  verification: 'not_verified',
  current_city_index: 40,
  projected_city_index: 30,
  city_reduction: 10,
  applied: [
    {
      asset_id: 'A',
      asset_name: 'Test gateway',
      action_type: 'patch_prioritization',
      name: 'Patch prioritization',
      modelled: true,
      effect: 'Test projected effect',
      effort_hours: 8,
      downtime_hours: 2,
      outcome: 'reduces_modelled_risk',
      operational_disruption: 'Assumed',
    },
  ],
  asset_deltas: [
    {
      asset_id: 'A',
      name: 'Test gateway',
      current_score: 80,
      projected_score: 60,
      current_category: 'critical',
      projected_category: 'critical',
    },
  ],
  services_before: [
    {
      service_id: 'S',
      name: 'Test essential service',
      sector: 'power',
      worst_disruption_fraction: 1,
      initiating_asset_id: 'A',
      initiating_asset_name: 'Test gateway',
      effect: 'unavailability',
    },
  ],
  services_after: [
    {
      service_id: 'S',
      name: 'Test essential service',
      sector: 'power',
      worst_disruption_fraction: 0.5,
      initiating_asset_id: 'A',
      initiating_asset_name: 'Test gateway',
      effect: 'unavailability',
    },
  ],
  notes: ['Simulation assumption'],
}
let latest: SimulationRun | null
beforeEach(() => {
  latest = run
  vi.spyOn(api, 'latestRun').mockImplementation(async () => latest)
  vi.spyOn(api, 'assets').mockResolvedValue(assets)
  vi.spyOn(api, 'scenarios').mockResolvedValue([
    { id: context.scenario_id, current_snapshot_id: context.snapshot_id },
  ] as Models['Scenario'][])
  vi.spyOn(api, 'actionOptions').mockResolvedValue(options)
  vi.spyOn(api, 'optimize').mockResolvedValue(plan)
  vi.spyOn(api, 'whatIf').mockResolvedValue(projection)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mount(path = '/remediation', state?: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  client.setQueryData(
    ['scenarios'],
    [{ id: context.scenario_id, current_snapshot_id: context.snapshot_id }],
  )
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route path="/remediation" element={<Remediation />} />
          <Route path="/what-if" element={<WhatIf />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { user, client }
}

describe('What-If baseline, errors and comparison', () => {
  it('detects a replaced baseline before posting and refreshes the cache', async () => {
    const update = vi.fn()
    latest = { ...run, id: 'replacement-run' }
    await expect(checkBaseline(run, update)).rejects.toThrow('simulation baseline changed')
    expect(update).toHaveBeenCalledWith(latest)
    expect(api.whatIf).not.toHaveBeenCalled()
  })
  it('shows a simulation-required state instead of fabricated results', async () => {
    latest = null
    mount('/what-if')
    await screen.findByText('Run the simulation to see results')
    expect(api.whatIf).not.toHaveBeenCalled()
  })
})

describe('workflow validation boundaries', () => {
  it('rejects empty, duplicate, too-large and unknown-asset action selections', () => {
    expect(validateActions([], assets).issues).toHaveLength(1)
    expect(validateActions([steps[0], steps[0]], assets).issues.join()).toContain('Duplicate')
    expect(
      validateActions(
        [{ asset_id: 'missing', action_type: 'access_control' }],
        assets,
      ).issues.join(),
    ).toContain('not in this scenario')
    expect(validateActions(Array(41).fill(steps[0]), assets).issues.join()).toContain('at most 40')
  })
  it('rejects malformed handoffs and handles zero-baseline relative change honestly', () => {
    expect(readHandoff({ kind: 'other' }).error).toBeTruthy()
    expect(readHandoff(makeHandoff(run, [steps[0]])).error).toBeNull()
    expect(relativeChange(0, 0)).toBeNull()
  })
  it('validates budget bounds and unknown exclusions', () => {
    for (const invalid of ['', '0', '-1', 'NaN', 'Infinity', '10001'])
      expect(validateBudget(invalid)).toBeTruthy()
    expect(validateBudget('10000')).toBeNull()
    expect(validateExclusions(['A', 'missing'], assets)).toEqual(['missing'])
  })
})

describe('Phase 5 final integration contract', () => {
  it('includes prerequisite closure in subset transfer and preserves server order', () => {
    const actions: Models['StagedActionRequest'][] = [
      { asset_id: 'A', action_type: 'incident_response_plan' },
      { asset_id: 'A', action_type: 'network_segmentation' },
    ]
    const constraints: Models['OperationalConstraints'] = {
      prerequisites: [{ action: 'network_segmentation', requires: 'incident_response_plan' }],
    }
    const source = {
      ...plan,
      steps: [
        {
          ...steps[0],
          action_type: 'incident_response_plan' as const,
          kind: 'prerequisite' as const,
        },
        { ...steps[0], rank: 2, action_type: 'network_segmentation' as const },
      ],
      what_if_request: { ...binding(run), actions, constraints },
    }
    const selected = selectPlanRequest(source, ['A:network_segmentation'])
    expect(selected.issues).toEqual([])
    expect(selected.request?.actions).toEqual(actions)
    expect(selected.request?.constraints).toEqual(constraints)
  })
  it('explains missing prerequisites and mismatched handoff baselines', () => {
    const broken = {
      ...plan,
      what_if_request: {
        ...binding(run),
        actions: [{ asset_id: 'A', action_type: 'patch_prioritization' as const }],
        constraints: {
          prerequisites: [
            {
              action: 'patch_prioritization' as const,
              requires: 'incident_response_plan' as const,
            },
          ],
        },
      },
    }
    expect(selectPlanRequest(broken, ['A:patch_prioritization']).issues.join()).toContain(
      'Missing prerequisite',
    )
    expect(
      selectPlanRequest(
        { ...plan, what_if_request: { ...plan.what_if_request!, run_id: 'other-run' } },
        ['A:patch_prioritization'],
      ).issues.join(),
    ).toContain('different baseline')
  })
})
