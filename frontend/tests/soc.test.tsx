// @vitest-environment jsdom
// UI boundary fixtures only; live TCP/SSE verification is separate.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api, ApiError, type Models } from '../src/api/client'
import Soc from '../src/features/soc/Soc'
import { SocProvider } from '../src/features/soc/provider'
import SocAlert from '../src/features/soc/SocAlert'
import { mapEvidence } from '../src/features/soc/evidence'
import WhatIf from '../src/features/whatif/WhatIf'

class Source {
  static instances: Source[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  handlers: Record<string, () => void> = {}
  closed = false
  constructor(public url: string) {
    Source.instances.push(this)
  }
  addEventListener(name: string, fn: () => void) {
    this.handlers[name] = fn
  }
  close() {
    this.closed = true
  }
}
const event = (id: number): Models['SocEvent'] => ({
  id,
  timestamp: '2026-11-01T10:00:00Z',
  source_ip: '192.0.2.10',
  asset_id: 'PWR-008',
  category: 'authorization.record',
  severity: 'high',
  outcome: 'unauthorized_read',
  method: 'GET',
  path: '/nodes/PWR-008/records/1002',
  status: 200,
  latency_ms: 2,
  explanation: 'Restricted fictional record returned.',
  rule_version: 'soc-rules-v1',
})
const snapshot: Models['SocSnapshot'] = {
  events: [event(1)],
  nodes: [
    {
      asset_id: 'PWR-008',
      name: 'Test dispatch',
      scenario: 'Record authorization',
      path: '/nodes/PWR-008/records/1002',
      protected: true,
    },
  ],
  blocks: [],
  cursor: 1,
  retained_events: 1,
  retention_floor: 1,
  operator: true,
  gateway_port: 8006,
  gateway_ready: true,
}
function setup(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SocProvider>
          <SocAlert />
          <Routes>
            <Route path="/what-if" element={<WhatIf />} />
            <Route path="*" element={<Soc />} />
          </Routes>
        </SocProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return Object.assign(userEvent.setup(), { client })
}

// Numerical fixtures only test UI handoff. Backend integration uses the actual saved model.
const modelAsset = {
  asset_id: 'PWR-008',
  name: 'Test dispatch',
  sector: 'power',
  risk: { score: 80, category: 'critical', factors: [] },
  vulnerability_signal: 0.8,
  exposure_factor: 1,
  impact_factor: 1,
  top_vulnerabilities: [],
} as unknown as Models['AssetSimulation']
const modelRun = {
  id: 'fixture-run',
  fingerprint: 'fixture-fingerprint-0123456789',
  scenario_id: 'aurora-city',
  snapshot_id: 'fixture-snapshot',
  assets: [modelAsset],
  city_risk: { score: 40 },
} as Models['SimulationRun']
const assessment = {
  ...modelRun,
  run_id: modelRun.id,
  baseline_fingerprint: modelRun.fingerprint,
  event_id: 2,
  event: event(2),
  model_version: 'ui-fixture-only',
  model_as_of: '2026-10-01',
  asset: modelAsset,
  options: [],
  notes: ['UI fixture only'],
  what_if_request: {
    scenario_id: modelRun.scenario_id,
    snapshot_id: modelRun.snapshot_id,
    run_id: modelRun.id,
    baseline_fingerprint: modelRun.fingerprint,
    actions: [{ asset_id: 'PWR-008', action_type: 'access_control' }],
  },
  projection: {
    run_id: modelRun.id,
    baseline_fingerprint: modelRun.fingerprint,
    current_city_index: 40,
    projected_city_index: 35,
    city_reduction: 5,
    asset_deltas: [],
    services_before: [],
    services_after: [],
    applied: [],
    notes: [],
  },
} as unknown as Models['SocAnalysis']
beforeEach(() => {
  Source.instances = []
  vi.stubGlobal('EventSource', Source)
  vi.spyOn(api, 'socSnapshot').mockResolvedValue(snapshot)
  vi.spyOn(api, 'socSession').mockResolvedValue({ operator: true })
  vi.spyOn(api, 'socBlock').mockResolvedValue(snapshot)
  vi.spyOn(api, 'socUnblock').mockResolvedValue(snapshot)
  vi.spyOn(api, 'socProtection').mockResolvedValue(snapshot)
  vi.spyOn(api, 'socHistory').mockResolvedValue([])
  vi.spyOn(api, 'latestRun').mockResolvedValue(null)
  vi.spyOn(api, 'scenarios').mockResolvedValue([])
  vi.spyOn(api, 'socAnalyze').mockRejectedValue(new Error('No bound model run in UI fixture'))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('SOC evidence and controls', () => {
  it('pages older evidence separately while live updates continue', async () => {
    vi.mocked(api.socSnapshot).mockResolvedValue({ ...snapshot, events: [event(10)], cursor: 10 })
    vi.mocked(api.socHistory).mockResolvedValue([event(5)])
    const user = setup('/security-logs')
    await screen.findByText('Event #10')
    await user.click(screen.getByRole('button', { name: 'Load earlier retained events' }))
    await screen.findByText('Event #5')
    expect(api.socHistory).toHaveBeenCalledWith(10)
    const current = Source.instances[Source.instances.length - 1]
    act(() => current.onmessage?.({ data: JSON.stringify(event(11)) }))
    expect(screen.queryByText('Event #11')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Return to live logs' }))
    await screen.findByText('Event #11')
  })
  it('updates logs from live SSE, deduplicates replay and cleans up its connection', async () => {
    setup('/security-logs')
    await screen.findByText('Event #1')
    await waitFor(() => expect(Source.instances).toHaveLength(1))
    const source = Source.instances[0]
    expect(source.url).toContain('after=1')
    act(() => {
      source.onopen?.()
      source.onmessage?.({ data: JSON.stringify(event(2)) })
    })
    await screen.findByText('Event #2')
    act(() => source.onmessage?.({ data: JSON.stringify(event(2)) }))
    expect(screen.getAllByText('Event #2')).toHaveLength(1)
    expect(screen.getByText('Live')).toBeTruthy()
    cleanup()
    expect(source.closed).toBe(true)
  })
  it('requires an operator session and displays denied remote bootstrap clearly', async () => {
    vi.mocked(api.socSnapshot).mockRejectedValue(new ApiError(401, 'Operator required'))
    vi.mocked(api.socSession).mockRejectedValue(new ApiError(403, 'Open the console locally'))
    const user = setup()
    await user.click(await screen.findByRole('button', { name: 'Open local operator session' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Open the console locally')
    expect(Source.instances).toHaveLength(0)
    expect(api.socBlock).not.toHaveBeenCalled()
  })
  it('sends explicit block reason, duration and source; shows enforcement errors', async () => {
    vi.mocked(api.socBlock).mockRejectedValue(new ApiError(409, 'Operator address protected'))
    const user = setup()
    await user.type(await screen.findByLabelText('Client IP'), '192.0.2.10')
    await user.click(screen.getByRole('button', { name: 'Block IP' }))
    expect(api.socBlock).toHaveBeenCalledWith({
      ip: '192.0.2.10',
      minutes: 10,
      reason: 'Operator reviewed suspicious activity',
    })
    expect((await screen.findByRole('alert')).textContent).toContain('Operator address protected')
  })
  it('uses exact asset protection and persisted unblock actions', async () => {
    vi.mocked(api.socSnapshot).mockResolvedValue({
      ...snapshot,
      blocks: [
        { ip: '192.0.2.10', reason: 'Reviewed evidence', expires_at: Date.now() / 1000 + 600 },
      ],
    })
    const user = setup('/soc-nodes')
    await user.click(await screen.findByRole('button', { name: 'Enable vulnerable profile' }))
    expect(api.socProtection).toHaveBeenCalledWith('PWR-008', false)
    await user.click(screen.getByRole('button', { name: 'Unblock 192.0.2.10' }))
    expect(api.socUnblock).toHaveBeenCalledWith('192.0.2.10')
  })
  it('resynchronizes gaps and rejects malformed event data without invented observations', async () => {
    setup('/security-logs')
    await screen.findByText('Event #1')
    await waitFor(() => expect(Source.instances).toHaveLength(1))
    act(() => Source.instances[0].handlers.gap())
    await waitFor(() => expect(api.socSnapshot).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(Source.instances.length).toBeGreaterThan(1))
    const latest = Source.instances[Source.instances.length - 1]
    act(() => latest.onmessage?.({ data: 'not json' }))
    await waitFor(() => expect(api.socSnapshot).toHaveBeenCalledTimes(3))
    expect(screen.getAllByText('Event #1')).toHaveLength(1)
  })
  it('renders untrusted evidence as text, never executable markup', async () => {
    vi.mocked(api.socSnapshot).mockResolvedValue({
      ...snapshot,
      events: [{ ...event(1), explanation: '<img src=x onerror=alert(1)>' }],
    })
    setup()
    await screen.findByText('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img')).toBeNull()
  })
  it('colours disclosures critical and alerts only for new live evidence, without replay storms', async () => {
    const user = setup()
    await screen.findByText('Event #1')
    expect(screen.queryByRole('alert')).toBeNull()
    const source = Source.instances[0]
    act(() => source.onmessage?.({ data: JSON.stringify(event(2)) }))
    expect((await screen.findByRole('alert')).textContent).toContain('CRITICAL')
    expect(screen.getByText('Event #2').closest('tr')?.className).toContain('soc-severity-critical')
    await user.click(screen.getByRole('button', { name: 'Dismiss alert' }))
    act(() => source.onmessage?.({ data: JSON.stringify(event(2)) }))
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => source.onmessage?.({ data: JSON.stringify(event(3)) }))
    expect(screen.queryByRole('alert')).toBeNull() // same burst is grouped
  })
  it('highlights only directed real neighbours and never calls a denied attempt compromise', () => {
    const edges = [
      { id: 'out', source_asset_id: 'PWR-008', target_asset_id: 'B' },
      { id: 'in', source_asset_id: 'C', target_asset_id: 'PWR-008' },
      { id: 'other', source_asset_id: 'B', target_asset_id: 'D' },
    ]
    const marks = mapEvidence([event(1)], edges, 'cyber')
    expect(marks.get('PWR-008')?.token).toBe('--risk-critical')
    expect(marks.get('B')?.explanation).toContain('not compromise')
    expect(marks.has('C')).toBe(false)
    expect(marks.has('D')).toBe(false)
    const denied = { ...event(2), outcome: 'blocked', severity: 'medium' as const }
    const attempt = mapEvidence([denied], edges, 'operational')
    expect(attempt.get('PWR-008')?.token).toBe('--risk-high')
    expect(attempt.has('B')).toBe(false)
    expect(mapEvidence([event(1)], edges, 'operational').get('B')?.explanation).toContain(
      'does not establish provider failure',
    )
  })
  it('automatically binds the actual API response to What-If, then invalidates a replaced run', async () => {
    vi.mocked(api.latestRun).mockResolvedValue(modelRun)
    vi.mocked(api.scenarios).mockResolvedValue([
      { id: modelRun.scenario_id, current_snapshot_id: modelRun.snapshot_id },
    ] as Models['Scenario'][])
    vi.mocked(api.socAnalyze).mockResolvedValue(assessment)
    vi.spyOn(api, 'actionOptions').mockResolvedValue([])
    const { client } = setup()
    await screen.findByText('Event #1')
    act(() => Source.instances[0].onmessage?.({ data: JSON.stringify(event(2)) }))
    await screen.findByRole('heading', { name: 'What-If' })
    expect(api.socAnalyze).toHaveBeenCalledWith({
      event_id: 2,
      scenario_id: modelRun.scenario_id,
      snapshot_id: modelRun.snapshot_id,
      run_id: modelRun.id,
      baseline_fingerprint: modelRun.fingerprint,
    })
    expect(
      (
        (await screen.findByLabelText(
          'Infrastructure asset (ordered by computed risk)',
        )) as HTMLSelectElement
      ).value,
    ).toBe('PWR-008')
    expect(screen.getByText('35.0')).toBeTruthy()
    act(() => client.setQueryData(['simulation', 'latest'], { ...modelRun, id: 'replaced-run' }))
    await screen.findByText(/This incident projection is stale/)
    expect(screen.queryByText('35.0')).toBeNull()
  })
  it('creates a first baseline only when absent and reports analysis failures explicitly', async () => {
    vi.mocked(api.scenarios).mockResolvedValue([
      { id: modelRun.scenario_id, current_snapshot_id: modelRun.snapshot_id },
    ] as Models['Scenario'][])
    vi.spyOn(api, 'runSimulation').mockResolvedValue(modelRun)
    vi.mocked(api.socAnalyze).mockRejectedValue(new ApiError(409, 'Fingerprint mismatch'))
    setup()
    await screen.findByText('Event #1')
    act(() => Source.instances[0].onmessage?.({ data: JSON.stringify(event(2)) }))
    await screen.findByText('Fingerprint mismatch')
    expect(api.runSimulation).toHaveBeenCalledTimes(1)
    expect(api.runSimulation).toHaveBeenCalledWith({
      scenario_id: modelRun.scenario_id,
      snapshot_id: modelRun.snapshot_id,
    })
    expect(screen.queryByRole('heading', { name: 'What-If' })).toBeNull()
  })
  it('notifies a critical event once when desktop permission already exists; never prompts automatically', async () => {
    const notify = vi.fn()
    class Notice {
      static permission = 'granted'
      static requestPermission = vi.fn()
      constructor(title: string, options: unknown) {
        notify(title, options)
      }
    }
    vi.stubGlobal('Notification', Notice)
    setup()
    await screen.findByText('Event #1')
    expect(notify).not.toHaveBeenCalled()
    act(() => {
      Source.instances[0].onmessage?.({ data: JSON.stringify(event(2)) })
      Source.instances[0].onmessage?.({ data: JSON.stringify(event(2)) })
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toContain('CRITICAL')
    expect(Notice.requestPermission).not.toHaveBeenCalled()
  })
})
