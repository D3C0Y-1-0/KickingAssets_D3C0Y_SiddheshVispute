// @vitest-environment jsdom
// Synthetic UI boundary fixtures only. Real Aurora/Phase 7 outputs are browser/API verified.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { api, ApiError, type Models, type SimulationRun } from '../src/api/client'
import Planner from '../src/features/planner/Planner'
import { Replay } from '../src/features/planner/Replay'
import { contains, eventsFor } from '../src/features/planner/model'

vi.mock('../src/features/infrastructure/ForceGraph', () => ({
  ForceGraph: () => <div>Real D3 is verified in browser</div>,
}))
const context = { scenario_id: 'test', snapshot_id: 'test-v1' }
const run = {
  ...context,
  id: 'run-test',
  fingerprint: 'a'.repeat(32),
  created_at: '2026-11-01T00:00:00Z',
  as_of: '2026-10-01',
  services: [{ service_id: 'S', name: 'Test service' }],
} as SimulationRun
const bound = { ...context, run_id: run.id, baseline_fingerprint: run.fingerprint }
const nodes = [
  { ...context, id: 'A', name: 'Test server', sector: 'power', criticality: 'essential' },
  { ...context, id: 'B', name: 'Test standby', sector: 'power', criticality: 'important' },
] as Models['InfrastructureAsset'][]
const action = (
  id: string,
  type: Models['Intervention']['action_type'],
  asset_id: string,
): Models['Intervention'] => ({
  id,
  asset_id,
  action_type: type,
  cost_credits: 4,
  effort_hours: 8,
  downtime_hours: 1,
  recovery_minutes: 3,
  added_backup_minutes: 0,
  patch: null,
  preconditions: ['Unit-test assumption'],
  modelled_effect: 'Unit-test effect',
  evidence_ids: ['A'],
})
const actions = [
  action('recover-A', 'recovery', 'A'),
  action('segment-A', 'segmentation', 'A'),
  action('backup-B', 'backup_power', 'B'),
]
const catalog = {
  ...bound,
  catalog_version: 'test',
  catalog_fingerprint: 'b'.repeat(64),
  baseline_as_of: run.as_of,
  baseline_created_at: run.created_at,
  model_version: 'test-model',
  interventions: actions,
  assumptions: ['Synthetic tests only'],
}
function outcome(end: number): Models['FailureOutcome'] {
  return {
    horizon_minutes: 10,
    total_service_disruption_minutes: end,
    asset_outages: [
      {
        asset_id: 'A',
        intervals: [{ start_minutes: 0, end_minutes: end }],
        failure_ids: ['planner-failure'],
        dependency_edge_ids: ['ops-test'],
      },
    ],
    services: [
      {
        service_id: 'S',
        disrupted_minutes: end,
        disruption_fraction: end / 10,
        intervals: [{ start_minutes: 0, end_minutes: end }],
        restored_at_minutes: end < 10 ? end : null,
      },
    ],
    standbys: [
      {
        service_id: 'S',
        requirement_id: 'backup',
        backup_asset_ids: ['B'],
        activation_condition: 'Test standby',
        activation_minutes: 2,
        exhaustion_minutes: 8,
        usable_duration_minutes: 6,
        available_intervals: [{ start_minutes: 2, end_minutes: 8 }],
      },
    ],
  }
}
function evaluation(ids: string[] = [], end = 8): Models['Evaluation'] {
  return {
    ...bound,
    baseline_created_at: run.created_at,
    baseline_as_of: run.as_of,
    model_version: 'test-model',
    scoring_version: 'test',
    catalog_fingerprint: catalog.catalog_fingerprint,
    input_fingerprint: 'c'.repeat(64),
    engine_version: 'test-engine',
    calculated_at: run.created_at,
    state: 'projected',
    verification: 'not_verified',
    interventions: actions.filter((a) => ids.includes(a.id)),
    cost_credits: ids.length * 4,
    effort_hours: ids.length * 8,
    downtime_hours: ids.length,
    comparison: {
      before: outcome(8),
      after: outcome(end),
      avoided_service_disruption_minutes: 8 - end,
      improved_service_ids: end < 8 ? ['S'] : [],
      fully_protected_service_ids: [],
      challenges: [],
    },
    baseline_city_index: 11,
    risk_projection: null,
    risk_projection_intervention_ids: [],
    assumptions: ['Synthetic tests only'],
  }
}
function plan(): Models['Optimization'] {
  return {
    ...evaluation(['recover-A'], 3),
    method: 'exhaustive-subsets-v1',
    optimal_within_submitted_candidates: true,
    objective_service_ids: ['S'],
    objective_before_minutes: 8,
    objective_after_minutes: 3,
    subsets_considered: 8,
    feasible_subsets: 4,
    rejected_alternatives: [
      {
        intervention_id: 'backup-B',
        reasons: ['budget_exceeded'],
        standalone_disruption_minutes: 4,
      },
    ],
  }
}
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/resilience-planner?asset=A']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<Planner />, { wrapper })
  return { client, user: userEvent.setup() }
}
async function start() {
  const result = setup()
  const horizon = await screen.findByRole('spinbutton', { name: 'Horizon (minutes)' })
  fireEvent.change(horizon, { target: { value: '10' } })
  await result.user.click(screen.getByRole('button', { name: 'Simulate failure' }))
  await screen.findByRole('group', { name: 'Resilience operational dependency graph' })
  return result
}
async function optimized() {
  const result = await start()
  await result.user.click(screen.getByRole('button', { name: 'Optimize protection' }))
  await screen.findByRole('button', { name: 'Replay protected scenario' })
  return result
}
async function protectedView() {
  const result = await optimized()
  await result.user.click(screen.getByRole('button', { name: 'Replay protected scenario' }))
  await screen.findByText(/Shorter outage intervals: A/)
  return result
}
beforeEach(() => {
  vi.spyOn(api, 'scenarios').mockResolvedValue([
    { id: context.scenario_id, current_snapshot_id: context.snapshot_id },
  ] as Models['Scenario'][])
  vi.spyOn(api, 'latestRun').mockResolvedValue(run)
  vi.spyOn(api, 'graph').mockResolvedValue({
    ...context,
    type: 'operational',
    nodes,
    edges: [],
  } as Models['OperationalGraph'])
  vi.spyOn(api, 'resilienceCatalog').mockResolvedValue(catalog)
  vi.spyOn(api, 'resilienceSimulate').mockImplementation(async (body) =>
    evaluation(body.intervention_ids ?? [], body.intervention_ids?.length ? 3 : 8),
  )
  vi.spyOn(api, 'resilienceOptimize').mockResolvedValue(plan())
  vi.spyOn(api, 'resilienceStress').mockImplementation(async (body) => ({
    nominal: evaluation(['recover-A'], 3),
    cases: [
      {
        case: body.cases[0],
        comparison: { ...evaluation().comparison, after: outcome(7) },
        extra_projected_disruption_minutes: 4,
      },
    ],
  }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('run-bound planner journey', () => {
  it('refuses cyber topology in the operational replay', async () => {
    vi.mocked(api.graph).mockResolvedValue({
      ...context,
      type: 'cyber',
      nodes,
      edges: [],
    } as Models['CyberGraph'])
    setup()
    await screen.findByText(/Operational graph and simulation context do not match/)
    expect(screen.queryByRole('button', { name: 'Simulate failure' })).toBeNull()
  })
  it('rejects a returned catalog fingerprint mismatch', async () => {
    vi.mocked(api.resilienceSimulate).mockResolvedValue({
      ...evaluation(),
      catalog_fingerprint: 'z'.repeat(64),
    })
    const { user } = setup()
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Horizon (minutes)' }), {
      target: { value: '10' },
    })
    await user.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await screen.findByText(/Resilience response context differs/)
    expect(
      screen.queryByRole('group', { name: 'Resilience operational dependency graph' }),
    ).toBeNull()
  })
  it('sends real binding/catalog/scenario and exact plan actions through all four APIs', async () => {
    const { user } = await protectedView()
    expect(api.resilienceCatalog).toHaveBeenCalledWith(bound)
    expect(api.graph).toHaveBeenCalledWith(
      'operational',
      expect.anything(),
      expect.any(AbortSignal),
    )
    expect(api.resilienceOptimize).toHaveBeenCalledWith(
      expect.objectContaining({
        ...bound,
        catalog_fingerprint: catalog.catalog_fingerprint,
        budget_credits: 12,
        effort_limit_hours: 24,
        downtime_limit_hours: 6,
        intervention_ids: ['backup-B', 'recover-A', 'segment-A'],
      }),
    )
    expect(api.resilienceSimulate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        intervention_ids: ['recover-A'],
        scenario: expect.objectContaining({ horizon_minutes: 10 }),
      }),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Standby provider' }), 'B')
    fireEvent.change(screen.getByRole('slider', { name: 'Usable backup energy fraction' }), {
      target: { value: '0.5' },
    })
    await user.click(screen.getByRole('checkbox', { name: /Force selected backup/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Additional hardware failure (optional)' }),
      'B',
    )
    await user.click(screen.getByRole('button', { name: 'Calculate stress test' }))
    await screen.findByText(/Extra versus nominal protected plan: 4/)
    expect(api.resilienceStress).toHaveBeenCalledWith(
      expect.objectContaining({
        ...bound,
        intervention_ids: ['recover-A'],
        cases: [
          expect.objectContaining({
            failed_backup_ids: ['B'],
            backup_capacity: [{ backup_asset_id: 'B', usable_energy_fraction: 0.5 }],
            additional_failures: [
              expect.objectContaining({ asset_id: 'B', cause: 'hardware_failure' }),
            ],
          }),
        ],
      }),
    )
  })
  it('invalidates a plan and replay when budget changes and accepts zero budget', async () => {
    await protectedView()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Budget (planning credits)' }), {
      target: { value: '0' },
    })
    expect(screen.getByText('Preventive plan outdated.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Replay protected scenario' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Calculate stress test' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Optimize protection' }).hasAttribute('disabled'),
    ).toBe(false)
  })
  it('clears a failure result when scenario changes and does not display absent as zero', async () => {
    await start()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Horizon (minutes)' }), {
      target: { value: '20' },
    })
    expect(screen.getByText('Failure simulation outdated.')).toBeTruthy()
    expect(
      screen.queryByRole('group', { name: 'Resilience operational dependency graph' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Optimize protection' }).hasAttribute('disabled'),
    ).toBe(true)
  })
  it('displays structured API issues and permits retry through the action', async () => {
    vi.mocked(api.resilienceSimulate).mockRejectedValueOnce(
      new ApiError(
        422,
        'Unsupported assumption',
        'invalid_actions',
        [],
        [{ path: 'scenario', code: 'bad_event', message: 'Review event' }],
      ),
    )
    const { user } = setup()
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Horizon (minutes)' }), {
      target: { value: '10' },
    })
    await user.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await screen.findByText('Unsupported assumption')
    expect(screen.getByText(/bad_event: Review event/)).toBeTruthy()
    expect(
      screen.queryByRole('group', { name: 'Resilience operational dependency graph' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await screen.findByRole('group', { name: 'Resilience operational dependency graph' })
  })
  it('rejects a mismatched returned run and refuses an over-budget plan', async () => {
    vi.mocked(api.resilienceOptimize).mockResolvedValue({ ...plan(), cost_credits: 999 })
    const { user } = await start()
    await user.click(screen.getByRole('button', { name: 'Optimize protection' }))
    await screen.findByText('Returned plan exceeds submitted planning limits.')
    expect(screen.queryByRole('button', { name: 'Replay protected scenario' })).toBeNull()
  })
  it('rejects an evaluation for a different run', async () => {
    vi.mocked(api.resilienceSimulate).mockResolvedValue({ ...evaluation(), run_id: 'wrong' })
    const { user } = setup()
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Horizon (minutes)' }), {
      target: { value: '10' },
    })
    await user.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await screen.findByText(/Resilience response belongs to another baseline/)
    expect(
      screen.queryByRole('group', { name: 'Resilience operational dependency graph' }),
    ).toBeNull()
  })
  it('clears old results when a new baseline arrives', async () => {
    const { client } = await start()
    const newer = { ...run, id: 'new-run' }
    vi.mocked(api.latestRun).mockResolvedValue(newer)
    vi.mocked(api.resilienceCatalog).mockResolvedValue({ ...catalog, run_id: newer.id })
    act(() => client.setQueryData(['simulation', 'latest'], newer))
    await screen.findByText(/Previous planner results were cleared/)
    expect(
      screen.queryByRole('group', { name: 'Resilience operational dependency graph' }),
    ).toBeNull()
  })
  it('hides a late response after inputs change', async () => {
    let resolve!: (value: Models['Evaluation']) => void
    vi.mocked(api.resilienceSimulate).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const { user } = setup()
    const horizon = await screen.findByRole('spinbutton', { name: 'Horizon (minutes)' })
    fireEvent.change(horizon, { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await waitFor(() => expect(api.resilienceSimulate).toHaveBeenCalled())
    fireEvent.change(horizon, { target: { value: '20' } })
    await act(async () => resolve(evaluation()))
    await screen.findByText('Failure simulation outdated.')
    expect(
      screen.queryByRole('group', { name: 'Resilience operational dependency graph' }),
    ).toBeNull()
  })
  it('requires a current simulation', async () => {
    vi.mocked(api.latestRun).mockResolvedValue(null)
    setup()
    await screen.findByText('Run the simulation to see results')
    expect(api.resilienceCatalog).not.toHaveBeenCalled()
  })
  it('shows catalog loading and a recoverable error', async () => {
    vi.mocked(api.resilienceCatalog).mockRejectedValueOnce(new Error('Catalog unavailable'))
    const { user } = setup()
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByText('Catalog unavailable')
    await user.click(screen.getByRole('button', { name: 'Retry connection' }))
    await screen.findByRole('button', { name: 'Simulate failure' })
  })
})

describe('API interval replay', () => {
  it('groups simultaneous events and never invents recovery at the horizon', () => {
    const events = eventsFor(outcome(10))
    expect(events.filter((e) => e.minute === 0).length).toBeGreaterThan(1)
    expect(events.some((e) => e.minute === 10 && /outage ends/.test(e.label))).toBe(false)
    expect(contains(outcome(10).asset_outages[0].intervals, 10, 10)).toBe(true)
  })
  it('plays only returned boundaries, pauses, scrubs and replays from zero', () => {
    vi.useFakeTimers()
    render(<Replay outcome={outcome(3)} nodes={nodes} edges={[]} names={new Map()} label="Test" />)
    const slider = screen.getByRole('slider', { name: 'Replay minute' }) as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: 'Play replay' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(slider.value).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(slider.value).toBe('2')
    fireEvent.change(slider, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next event' }))
    expect(slider.value).toBe('8')
    fireEvent.click(screen.getByRole('button', { name: 'Replay from start' }))
    expect(slider.value).toBe('0')
  })
})
