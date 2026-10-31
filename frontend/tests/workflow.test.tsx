// @vitest-environment jsdom
// Test-only numerical fixtures exercise UI states; production always calls the backend.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api, ApiError, type Asset, type Models, type SimulationRun } from '../src/api/client'
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
async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Generate plan' }))
  await screen.findByRole('button', { name: 'Simulate full plan in What-If' })
}

describe('planning inputs and result freshness', () => {
  it('invalidates a calculated plan immediately when the budget changes', async () => {
    const { user } = mount()
    await generate(user)
    await user.clear(screen.getByLabelText('Effort budget (hours)'))
    await user.type(screen.getByLabelText('Effort budget (hours)'), '8')
    expect(screen.getByText('Plan outdated.')).toBeTruthy()
    expect(screen.queryByLabelText('Simulated risk comparison')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Simulate full plan in What-If' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Recalculate Plan' })).toBeTruthy()
  })
  it('searches, multi-selects and removes inventory-validated exclusions', async () => {
    const { user } = mount()
    const search = await screen.findByLabelText('Search assets to exclude')
    await user.type(search, 'gateway')
    expect(screen.queryByLabelText('Exclude B · Test controller')).toBeNull()
    await user.click(screen.getByLabelText('Exclude A · Test gateway'))
    await user.clear(search)
    await user.click(screen.getByLabelText('Exclude B · Test controller'))
    await user.click(screen.getByRole('button', { name: 'Remove exclusion A' }))
    vi.mocked(api.optimize).mockResolvedValue({ ...plan, steps: [steps[0]] })
    await user.click(screen.getByRole('button', { name: 'Generate plan' }))
    await waitFor(() =>
      expect(api.optimize).toHaveBeenCalledWith(
        expect.objectContaining({ excluded_asset_ids: ['B'] }),
      ),
    )
    await screen.findByRole('button', { name: 'Simulate full plan in What-If' })
  })
  it('marks a plan outdated on an exclusion change', async () => {
    const { user } = mount()
    await generate(user)
    await user.click(screen.getByLabelText('Exclude A · Test gateway'))
    expect(screen.getByText('Plan outdated.')).toBeTruthy()
  })
  it('blocks a backend plan that recommends an excluded target', async () => {
    const { user } = mount()
    await user.click(await screen.findByLabelText('Exclude A · Test gateway'))
    await user.click(screen.getByRole('button', { name: 'Generate plan' }))
    await screen.findByText(/The API returned an excluded target/)
    expect(screen.queryByRole('button', { name: 'Simulate full plan in What-If' })).toBeNull()
  })
  it('handles empty searches and invalid budgets without calling optimize', async () => {
    const { user } = mount()
    await user.type(await screen.findByLabelText('Search assets to exclude'), 'no-match')
    expect(screen.getByText('No inventory assets match this search.')).toBeTruthy()
    await user.clear(screen.getByLabelText('Effort budget (hours)'))
    expect(
      (screen.getByRole('button', { name: 'Generate plan' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(api.optimize).not.toHaveBeenCalled()
  })
  it('shows an API error and supports retry', async () => {
    vi.mocked(api.optimize).mockRejectedValueOnce(new Error('Planner unavailable'))
    const { user } = mount()
    await user.click(await screen.findByRole('button', { name: 'Generate plan' }))
    await screen.findByText(/Planner unavailable/)
    await user.click(screen.getByRole('button', { name: 'Recalculate Plan' }))
    await screen.findByRole('button', { name: 'Simulate full plan in What-If' })
  })
  it('handles a valid plan with no beneficial actions', async () => {
    vi.mocked(api.optimize).mockResolvedValue({
      ...plan,
      steps: [],
      used_hours: 0,
      ending_city_index: 40,
    })
    const { user } = mount()
    await user.click(await screen.findByRole('button', { name: 'Generate plan' }))
    await screen.findByText('No beneficial action fits these inputs')
  })
  it('does not show an in-flight old-input response as current', async () => {
    let finish!: (result: Models['RemediationPlan']) => void
    vi.mocked(api.optimize).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { user } = mount()
    await user.click(await screen.findByRole('button', { name: 'Generate plan' }))
    await waitFor(() => expect(api.optimize).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Calculating plan…' })).toBeTruthy()
    await user.clear(screen.getByLabelText('Effort budget (hours)'))
    await user.type(screen.getByLabelText('Effort budget (hours)'), '8')
    await act(async () => finish(plan))
    await screen.findByText('Plan outdated.')
    expect(screen.queryByLabelText('Simulated risk comparison')).toBeNull()
  })
})

describe('typed plan-to-What-If handoff', () => {
  it('hands off one action and recalculates using the existing request contract', async () => {
    const { user } = mount()
    await generate(user)
    await user.click(
      screen.getByRole('button', { name: 'Simulate Patch prioritization for A in What-If' }),
    )
    await screen.findByText('1 STAGED')
    expect(screen.queryByText('Affected assets (1)')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Affected assets (1)')
    expect(api.whatIf).toHaveBeenCalledWith({
      ...context,
      run_id: run.id,
      baseline_fingerprint: run.fingerprint,
      constraints: null,
      actions: [{ asset_id: 'A', action_type: 'patch_prioritization' }],
    })
    expect(Object.keys(vi.mocked(api.whatIf).mock.calls[0][0]).sort()).toEqual([
      'actions',
      'baseline_fingerprint',
      'constraints',
      'run_id',
      'scenario_id',
      'snapshot_id',
    ])
    expect(screen.getByText('25.00% relative reduction')).toBeTruthy()
    expect(screen.getByText('50.0%')).toBeTruthy()
  })
  it('hands off all supported plan steps without calculating automatically', async () => {
    const { user } = mount()
    await generate(user)
    await user.click(screen.getByRole('button', { name: 'Simulate full plan in What-If' }))
    await screen.findByText('2 STAGED')
    expect(api.whatIf).not.toHaveBeenCalled()
  })
  it('hands off only the selected subset', async () => {
    const { user } = mount()
    await generate(user)
    await user.click(screen.getByLabelText('Select Access-control improvement for B'))
    await user.click(
      screen.getByRole('button', { name: 'Simulate selected actions in What-If (1)' }),
    )
    await screen.findByRole('button', { name: 'Remove access_control for B' })
    expect(screen.queryByRole('button', { name: 'Remove patch_prioritization for A' })).toBeNull()
  })
  it('explains unsupported backend actions and prevents full-plan transfer', async () => {
    const unsupported = {
      ...steps[0],
      action_type: 'future_patch',
    } as unknown as Models['PlanStep']
    vi.mocked(api.optimize).mockResolvedValue({ ...plan, steps: [unsupported] })
    const { user } = mount()
    await user.click(await screen.findByRole('button', { name: 'Generate plan' }))
    const button = await screen.findByRole('button', { name: 'Simulate full plan in What-If' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText(/future_patch on A is not supported/).length).toBeGreaterThan(0)
  })
  it('blocks invalid or unsupported navigation state rather than silently omitting it', async () => {
    const { user } = mount(
      '/what-if',
      makeHandoff(run, [{ asset_id: 'A', action_type: 'future_patch' }]),
    )
    await screen.findByText('Actions were not imported.')
    expect(screen.getByText('0 STAGED')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Calculate projected risk' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Discard handoff and stage manually' }))
    expect(screen.queryByText('Actions were not imported.')).toBeNull()
  })
  it('requires explicit review when a transferred baseline is old', async () => {
    const { user } = mount(
      '/what-if',
      makeHandoff({ ...run, id: 'old-run' }, [
        { asset_id: 'A', action_type: 'patch_prioritization' },
      ]),
    )
    await screen.findByText('Staged baseline changed.')
    expect(
      (screen.getByRole('button', { name: 'Calculate projected risk' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Use latest baseline' }))
    await user.click(screen.getByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Affected assets (1)')
  })
})

describe('What-If baseline, errors and comparison', () => {
  it('invalidates results on action edits and shows all affected assets', async () => {
    vi.mocked(api.whatIf).mockResolvedValue({
      ...projection,
      asset_deltas: Array.from({ length: 15 }, (_, i) => ({
        ...projection.asset_deltas[0],
        asset_id: `T-${i}`,
        name: `Affected ${i}`,
      })),
    })
    const { user } = mount(
      '/what-if',
      makeHandoff(run, [{ asset_id: 'A', action_type: 'patch_prioritization' }]),
    )
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Affected assets (15)')
    expect(screen.getByText('Affected 14')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove patch_prioritization for A' }))
    expect(screen.getByText('Projection outdated.')).toBeTruthy()
    expect(screen.queryByText('Affected assets (15)')).toBeNull()
  })
  it('marks a plan outdated when the current simulation run changes', async () => {
    const { user, client } = mount()
    await generate(user)
    latest = { ...run, id: 'new-run', created_at: '2026-10-31T11:00:00Z' }
    act(() => client.setQueryData(['simulation', 'latest'], latest))
    await screen.findByText('Plan outdated.')
  })
  it('detects a replaced baseline before posting and refreshes the cache', async () => {
    const update = vi.fn()
    latest = { ...run, id: 'replacement-run' }
    await expect(checkBaseline(run, update)).rejects.toThrow('simulation baseline changed')
    expect(update).toHaveBeenCalledWith(latest)
    expect(api.whatIf).not.toHaveBeenCalled()
  })
  it('rejects a response calculated for a different run', async () => {
    vi.mocked(api.whatIf).mockResolvedValue({ ...projection, run_id: 'wrong-run' })
    const { user } = mount(
      '/what-if',
      makeHandoff(run, [{ asset_id: 'A', action_type: 'patch_prioritization' }]),
    )
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText(/The simulation baseline changed. Review/)
    expect(screen.queryByLabelText('Simulated risk comparison')).toBeNull()
  })
  it('hides an existing projection and requires review when the baseline changes', async () => {
    const { user, client } = mount('/what-if', makeHandoff(run, [steps[0]]))
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Affected assets (1)')
    latest = { ...run, id: 'new-run', created_at: '2026-10-31T11:00:00Z' }
    act(() => client.setQueryData(['simulation', 'latest'], latest))
    await screen.findByText('Projection outdated.')
    expect(screen.queryByLabelText('Simulated risk comparison')).toBeNull()
    expect(screen.getByRole('button', { name: 'Use latest baseline' })).toBeTruthy()
  })
  it('rejects an in-flight result after another client replaces the baseline', async () => {
    vi.mocked(api.whatIf).mockImplementation(async () => {
      latest = { ...run, id: 'other-client-run' }
      return projection
    })
    const { user } = mount('/what-if', makeHandoff(run, [steps[0]]))
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText(/The simulation baseline changed. Review/)
    expect(screen.queryByLabelText('Simulated risk comparison')).toBeNull()
  })
  it('shows retry for unavailable action options', async () => {
    vi.mocked(api.actionOptions).mockRejectedValueOnce(new Error('Options unavailable'))
    const { user } = mount('/what-if')
    await screen.findByText('Options unavailable')
    await user.click(screen.getByRole('button', { name: 'Retry connection' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Infrastructure asset (ordered by computed risk)' }),
      'A',
    )
    await screen.findByRole('heading', { name: 'Patch prioritization' })
  })
  it('shows a simulation-required state instead of fabricated results', async () => {
    latest = null
    mount('/what-if')
    await screen.findByText('Run the simulation to see results')
    expect(api.whatIf).not.toHaveBeenCalled()
  })
  it('retains staged actions after a projection error for retry', async () => {
    vi.mocked(api.whatIf).mockRejectedValueOnce(new Error('Projection unavailable'))
    const { user } = mount(
      '/what-if',
      makeHandoff(run, [{ asset_id: 'A', action_type: 'patch_prioritization' }]),
    )
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Projection unavailable')
    expect(screen.getByText('1 STAGED')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Recalculate projected risk' }))
    await screen.findByText('Affected assets (1)')
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
  it('binds optimizer requests to the exact run and fingerprint', async () => {
    const { user } = mount()
    await generate(user)
    expect(api.optimize).toHaveBeenCalledWith({
      ...binding(run),
      effort_budget_hours: 60,
      excluded_asset_ids: [],
      constraints: null,
    })
    expect(api.actionOptions).not.toHaveBeenCalled()
  })
  it('scopes action options to the current run', async () => {
    mount('/what-if')
    await waitFor(() => expect(api.actionOptions).toHaveBeenCalledWith(undefined, run.id))
  })
  it('marks plans stale when maintenance limits change and sends the new constraints', async () => {
    const { user } = mount()
    await generate(user)
    await user.type(screen.getByLabelText('Longest maintenance window per action (hours)'), '2')
    await user.type(screen.getByLabelText('Maximum total downtime (hours)'), '4')
    expect(screen.getByText('Plan outdated.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Recalculate Plan' }))
    await waitFor(() =>
      expect(api.optimize).toHaveBeenLastCalledWith(
        expect.objectContaining({
          constraints: { max_downtime_per_action_hours: 2, max_total_downtime_hours: 4 },
        }),
      ),
    )
  })
  it('rejects an invalid single-action window before sending', async () => {
    const { user } = mount()
    await user.type(
      await screen.findByLabelText('Longest maintenance window per action (hours)'),
      '0',
    )
    expect(
      (screen.getByRole('button', { name: 'Generate plan' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(api.optimize).not.toHaveBeenCalled()
  })
  it('preserves exact CVE parameters and constraints in a full-plan handoff', async () => {
    const request: Models['WhatIfRequest'] = {
      ...binding(run),
      actions: [
        {
          asset_id: 'A',
          action_type: 'patch_prioritization',
          cve_ids: ['CVE-2022-0778'],
          target_version: '3.1.1',
        },
        { asset_id: 'B', action_type: 'access_control', cve_ids: null, target_version: null },
      ],
      constraints: { max_total_downtime_hours: 4 },
    }
    vi.mocked(api.optimize).mockResolvedValue({ ...plan, what_if_request: request })
    const { user } = mount()
    await generate(user)
    await user.click(screen.getByRole('button', { name: 'Simulate full plan in What-If' }))
    await screen.findByText('2 STAGED')
    expect(
      (screen.getByLabelText('Patch CVE IDs for A (optional)') as HTMLInputElement).value,
    ).toBe('CVE-2022-0778')
    await user.click(screen.getByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Affected assets (1)')
    expect(api.whatIf).toHaveBeenCalledWith(request)
  })
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
  it('retains comma-separated CVE editing and target versions, invalidating old comparisons', async () => {
    const { user } = mount(
      '/what-if',
      makeHandoff(run, [{ asset_id: 'A', action_type: 'patch_prioritization' }]),
    )
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Affected assets (1)')
    await user.type(
      screen.getByLabelText('Patch CVE IDs for A (optional)'),
      'CVE-2022-0778, CVE-2022-0779',
    )
    await user.type(screen.getByLabelText('Target version for A (optional)'), '3.1.1')
    expect(screen.getByText('Projection outdated.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Recalculate projected risk' }))
    await waitFor(() =>
      expect(api.whatIf).toHaveBeenLastCalledWith(
        expect.objectContaining({
          actions: [
            {
              asset_id: 'A',
              action_type: 'patch_prioritization',
              cve_ids: ['CVE-2022-0778', 'CVE-2022-0779'],
              target_version: '3.1.1',
            },
          ],
        }),
      ),
    )
  })
  it('renders structured validation issues without losing staged actions', async () => {
    vi.mocked(api.whatIf).mockRejectedValue(
      new ApiError(
        422,
        'The actions do not fit.',
        'constraint_violation',
        [],
        [{ path: 'actions[0]', code: 'exceeds_maintenance_window', message: 'Needs 6 hours.' }],
      ),
    )
    const { user } = mount('/what-if', makeHandoff(run, [steps[0]]))
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText(/exceeds_maintenance_window: Needs 6 hours/)
    expect(screen.getByText('1 STAGED')).toBeTruthy()
    expect(screen.getByText('HTTP 422 · constraint_violation')).toBeTruthy()
  })
  it('rejects a wrong fingerprint even when the run ID matches', async () => {
    vi.mocked(api.whatIf).mockResolvedValue({
      ...projection,
      baseline_fingerprint: 'wrong-fingerprint',
    })
    const { user } = mount('/what-if', makeHandoff(run, [steps[0]]))
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText(/The simulation baseline changed. Review/)
    expect(screen.queryByLabelText('Simulated risk comparison')).toBeNull()
  })
  it('preserves NVD evidence for unresolved CVEs without claiming a benefit', async () => {
    const patch: Models['PatchOutcome'] = {
      scope: 'explicit_cves',
      target_version: null,
      remediated: [],
      not_remediated: [
        {
          cve_id: 'CVE-2022-0778',
          status: 'fix_version_not_documented',
          applicability: 'version_unknown',
          fixed_in: null,
          reason: 'NVD does not establish a fixed version.',
        },
      ],
    }
    vi.mocked(api.whatIf).mockResolvedValue({
      ...projection,
      applied: [{ ...projection.applied[0], outcome: 'no_modelled_reduction', patch }],
    })
    const { user } = mount('/what-if', makeHandoff(run, [steps[0]]))
    await user.click(await screen.findByRole('button', { name: 'Calculate projected risk' }))
    await screen.findByText('Patch evidence · 0 remediated / 1 unresolved')
    expect(screen.getByText(/not documented.*NVD does not establish/)).toBeTruthy()
  })
})
