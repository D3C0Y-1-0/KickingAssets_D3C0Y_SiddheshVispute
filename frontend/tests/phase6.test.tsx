// @vitest-environment jsdom
// Fixtures below test UI boundaries only; actual model/engine outputs are verified separately.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentType, ReactNode } from 'react'
import { api, type Models, type SimulationRun } from '../src/api/client'
import { useLatestRun } from '../src/hooks/queries'
import { useLiveSimulation } from '../src/hooks/liveSimulation'
import AttackPaths from '../src/features/attack-paths/AttackPaths'
import Overview from '../src/features/overview/Overview'
import Infrastructure from '../src/features/infrastructure/Infrastructure'
import DigitalTwins from '../src/features/digital-twins/DigitalTwins'
import Intelligence from '../src/features/intelligence/Intelligence'
import MlLab from '../src/features/ml/MlLab'
import WhatIf from '../src/features/whatif/WhatIf'
import Remediation from '../src/features/remediation/Remediation'
import Resilience from '../src/features/resilience/Resilience'
import Methodology from '../src/features/methodology/Methodology'
import { SocProvider } from '../src/features/soc/provider'

// Diagram rendering is exercised in the real browser, not emulated by jsdom.
vi.mock('../src/features/infrastructure/ForceGraph', () => ({
  ForceGraph: () => <div>Graph viewport</div>,
}))
vi.mock('../src/components/smartcity/SmartCityViewer', () => ({
  SmartCityViewer: () => <div>Illustrative diagram</div>,
}))
vi.mock('../src/components/anatomy/SubstationViewer', () => ({
  SubstationViewer: () => <div>Illustrative diagram</div>,
}))
vi.mock('../src/components/waterplant/WaterPlantViewer', () => ({
  WaterPlantViewer: () => <div>Illustrative diagram</div>,
}))
vi.mock('../src/components/transit/TransitViewer', () => ({
  TransitViewer: () => <div>Illustrative diagram</div>,
}))
vi.mock('../src/components/hospital/HospitalViewer', () => ({
  HospitalViewer: () => <div>Illustrative diagram</div>,
}))

const context = { scenario_id: 'test-city', snapshot_id: 'test-snapshot' }
const run = {
  ...context,
  id: 'test-run',
  fingerprint: 'test-fingerprint-123456',
  created_at: '2026-11-01T00:00:00Z',
  as_of: '2026-10-01',
  city_risk: { score: 40 },
  stages: [],
  assets: [
    { asset_id: 'ENTRY', name: 'Gateway', risk: { category: 'critical', score: 60 } },
    { asset_id: 'TARGET', name: 'Controller', risk: { category: 'high', score: 40 } },
  ],
  services: [{ service_id: 'SERVICE', name: 'Essential service' }],
} as unknown as SimulationRun
const report: Models['AttackPathReport'] = {
  ...context,
  run_id: run.id,
  baseline_fingerprint: run.fingerprint,
  state: 'current',
  isolated_assets: [],
  method_version: 'attack-path-v1',
  entry_points: ['ENTRY'],
  targets: ['TARGET'],
  unknown_exposure_assets: [],
  chokepoints: [],
  target_reachability: [
    { target: 'TARGET', reachable: true, supported_paths: 1, verdict: 'supported_path' },
  ],
  notes: ['Test-only analysis fixture'],
  paths: [
    {
      rank: 1,
      entry_point: 'ENTRY',
      target: 'TARGET',
      nodes: ['ENTRY', 'TARGET'],
      status: 'insufficient_evidence',
      ranking_score: 0.18,
      weakest_hop: 1,
      final_effects: ['loss_of_control'],
      consequence: {
        effect: 'loss_of_control',
        max_disruption: 1,
        services: [{ service_id: 'SERVICE', disruption_fraction: 1 }],
      },
      explanation: 'The last step has insufficient vulnerability evidence.',
      hops: [
        {
          edge_id: null,
          source: 'internet',
          target: 'ENTRY',
          protocol: null,
          access: null,
          status: 'plausible',
          basis: ['remote_management_without_mfa'],
          effects: [],
          explanation: 'Declared exposure and remote management without MFA.',
        },
        {
          edge_id: 'CYBER-1',
          source: 'ENTRY',
          target: 'TARGET',
          protocol: 'HTTPS',
          access: 'network',
          status: 'insufficient_evidence',
          basis: ['vulnerability_evidence_unavailable'],
          effects: ['loss_of_control'],
          explanation: 'No exploitation evidence was supplied.',
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.spyOn(api, 'socSnapshot').mockRejectedValue(new Error('No SOC operator in module fixture'))
  vi.spyOn(api, 'scenarios').mockResolvedValue([
    { id: context.scenario_id, current_snapshot_id: context.snapshot_id },
  ] as Models['Scenario'][])
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function setup(path = '/attack-paths') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  client.setQueryData(
    ['scenarios'],
    [{ id: context.scenario_id, current_snapshot_id: context.snapshot_id }],
  )
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SocProvider>{children}</SocProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { client, wrapper, user: userEvent.setup() }
}
describe('run-bound attack-path inspection', () => {
  beforeEach(() => {
    vi.spyOn(api, 'latestRun').mockResolvedValue(run)
    vi.spyOn(api, 'attackPaths').mockResolvedValue(report)
  })
  it('presents hop uncertainty and operational consequences separately from compromise', async () => {
    const { wrapper } = setup()
    render(<AttackPaths />, { wrapper })
    await screen.findByText('Path evidence')
    expect(screen.getByText(/Candidate routes, not confirmed compromises/)).toBeTruthy()
    expect(screen.getByText(/No exploitation evidence was supplied/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Conditional operational impact' })).toBeTruthy()
    expect(screen.getByText('Essential service')).toBeTruthy()
    expect(api.attackPaths).toHaveBeenCalledWith(run, [], 5, expect.any(AbortSignal))
  })
  it('changes isolation through the typed endpoint and shows an honest empty state', async () => {
    vi.mocked(api.attackPaths).mockImplementation(async (_, isolated) => ({
      ...report,
      state: isolated.length ? 'projected' : 'current',
      isolated_assets: isolated,
      paths: isolated.length ? [] : report.paths,
    }))
    const { wrapper, user } = setup()
    render(<AttackPaths />, { wrapper })
    await screen.findByText('Path evidence')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Hypothetical isolated asset' }),
      'TARGET',
    )
    await user.click(screen.getByRole('button', { name: 'Add isolation' }))
    await screen.findByText('No reported path matches this view')
    expect(screen.getByText(/No supported path is not proof/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove isolation TARGET' }))
    await screen.findByText('Path evidence')
  })
  it('retains loading and error/retry states without fabricated paths', async () => {
    vi.mocked(api.attackPaths).mockRejectedValueOnce(new Error('Analysis unavailable'))
    const { wrapper, user } = setup()
    render(<AttackPaths />, { wrapper })
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByText('Analysis unavailable')
    expect(screen.queryByText('Path evidence')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry connection' }))
    await screen.findByText('Path evidence')
  })
  it('rejects a response for another run instead of displaying its paths', async () => {
    vi.mocked(api.attackPaths).mockResolvedValue({ ...report, run_id: 'other-run' })
    const { wrapper } = setup()
    render(<AttackPaths />, { wrapper })
    await screen.findByText(/Attack-path results belong to another baseline/)
    expect(screen.queryByText('Path evidence')).toBeNull()
  })
  it('requires a simulation and filters targets without inventing a zero-risk route', async () => {
    vi.mocked(api.latestRun).mockResolvedValue(null)
    const { wrapper } = setup()
    render(<AttackPaths />, { wrapper })
    await screen.findByText('Run the simulation to see results')
    expect(api.attackPaths).not.toHaveBeenCalled()
  })
  it('drops previous-run reports when the baseline changes', async () => {
    const { wrapper, client } = setup()
    render(<AttackPaths />, { wrapper })
    await screen.findByText('Path evidence')
    vi.mocked(api.latestRun).mockResolvedValue({ ...run, id: 'new-run' })
    vi.mocked(api.attackPaths).mockImplementation(() => new Promise(() => {}))
    act(() => client.setQueryData(['simulation', 'latest'], { ...run, id: 'new-run' }))
    await waitFor(() => expect(screen.queryByText('Path evidence')).toBeNull())
  })
})

describe('shared simulation freshness', () => {
  function Probe() {
    const latest = useLatestRun()
    return (
      <>
        <output>{latest.data?.id ?? 'Unavailable'}</output>
        <button onClick={() => void latest.refetch()}>Refresh</button>
      </>
    )
  }
  it('hides cached risk after a failed latest-run read', async () => {
    vi.spyOn(api, 'latestRun').mockRejectedValue(new Error('API unavailable'))
    const { wrapper, client, user } = setup()
    client.setQueryData(['simulation', 'latest'], run)
    render(<Probe />, { wrapper })
    expect(screen.getByText(run.id)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Unavailable')
  })
  it('does not join a simulation from a different snapshot to the selected inventory', async () => {
    vi.spyOn(api, 'latestRun').mockResolvedValue({ ...run, snapshot_id: 'other-snapshot' })
    const { wrapper } = setup()
    render(<Probe />, { wrapper })
    await waitFor(() => expect(api.latestRun).toHaveBeenCalled())
    expect(screen.queryByText(run.id)).toBeNull()
  })
})

describe('Live Simulation report verification', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok' } as Models['Health'])
    vi.spyOn(api, 'runSimulation').mockResolvedValue(run)
    vi.spyOn(api, 'activity').mockResolvedValue({
      latest: { anomalous_assets: 0, band: 'quiet' },
      assets: [],
    } as unknown as Models['ActivityReport'])
    vi.spyOn(api, 'chokepoints').mockResolvedValue({
      chokepoints: [],
    } as unknown as Models['ChokepointReport'])
    vi.spyOn(api, 'vendors').mockResolvedValue({ vendors: [] } as unknown as Models['VendorReport'])
    vi.spyOn(api, 'optimize').mockResolvedValue({
      steps: [],
      starting_city_index: 40,
      ending_city_index: 40,
    } as unknown as Models['RemediationPlan'])
    vi.spyOn(api, 'prevention').mockResolvedValue({
      status: 'nothing_to_cut',
      assets: [],
    } as unknown as Models['CutPlan'])
  })
  it('fetches the actual report before announcing it is ready', async () => {
    vi.spyOn(api, 'riskBrief').mockResolvedValue({ run_id: run.id } as Models['RiskBrief'])
    const { wrapper } = setup()
    const { result } = renderHook(() => useLiveSimulation(), { wrapper })
    await act(async () => {
      await result.current.start()
    })
    expect(api.riskBrief).toHaveBeenCalledWith(context)
    expect(result.current.steps.find((step) => step.id === 'brief')?.status).toBe('done')
  })
  it.each(['failure', 'wrong run'])('does not announce readiness on report %s', async (mode) => {
    const brief = vi.spyOn(api, 'riskBrief')
    if (mode === 'failure') brief.mockRejectedValue(new Error('Report unavailable'))
    else brief.mockResolvedValue({ run_id: 'other-run' } as Models['RiskBrief'])
    const { wrapper } = setup()
    const { result } = renderHook(() => useLiveSimulation(), { wrapper })
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.steps.find((step) => step.id === 'brief')?.status).toBe('error')
    expect(result.current.log.join()).not.toContain('Report fetched and checked')
  })
})

const modules: [string, ComponentType][] = [
  ['Overview', Overview],
  ['Infrastructure', Infrastructure],
  ['Digital Twins', DigitalTwins],
  ['Risk Ranking', Intelligence],
  ['AI Model', MlLab],
  ['What-If', WhatIf],
  ['Fix Plan', Remediation],
  ['Weak Points', Resilience],
]
const reads = [
  'assets',
  'services',
  'graph',
  'latestRun',
  'intelligence',
  'vulnerabilityAssessment',
  'vulnerabilityReferences',
  'mlOverview',
  'products',
  'activity',
  'assetActivity',
  'trend',
  'chokepoints',
  'vendors',
] as const
describe('application module API-failure boundaries', () => {
  it.each(modules)(
    '%s renders failure without a substituted calculated result',
    async (_, Component) => {
      for (const name of reads)
        vi.spyOn(api, name).mockRejectedValue(new Error('API unavailable for module audit'))
      const { wrapper } = setup()
      render(<Component />, { wrapper })
      await screen.findAllByText('API unavailable for module audit')
      expect(screen.queryByText('Simulated risk comparison')).toBeNull()
    },
  )
  it.each(modules)('%s indicates pending reads', async (name, Component) => {
    for (const field of reads)
      vi.spyOn(api, field).mockImplementation(() => new Promise<never>(() => {}))
    const { wrapper } = setup()
    render(<Component />, { wrapper })
    if (name === 'Digital Twins') expect(screen.getByText('Checking calculated risk…')).toBeTruthy()
    else expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })
  it('methodology discloses its limits rather than claiming live observations', () => {
    const { wrapper } = setup()
    render(<Methodology />, { wrapper })
    expect(
      screen.getByText('Verification of actual installed products and exploitation'),
    ).toBeTruthy()
    expect(screen.getAllByText(/No live|No live/).length).toBeGreaterThan(0)
  })
})
