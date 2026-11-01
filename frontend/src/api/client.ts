import type { components } from './schema'

export type Models = components['schemas']
export type Asset = Models['InfrastructureAsset']
export type Sector = Asset['sector']
export type GraphMode = 'cyber' | 'operational'
export type SimulationRun = Models['SimulationRun']
export type AssetSimulation = Models['AssetSimulation']
export type ActionType = Models['ActionDefinition']['type']
export type ActivityReport = Models['ActivityReport']
export type AssetActivity = Models['AssetActivity']
export type VendorReport = Models['VendorReport']
export type ChokepointReport = Models['ChokepointReport']
export type PostureTrend = Models['PostureTrend']
export type AttackerView = Models['AttackerView']
export type CutPlan = Models['CutPlan']
export type ReactionPlan = Models['ReactionPlan']
type Context = { scenario_id: string; snapshot_id?: string }
type QueryParams = Record<string, string | string[] | undefined>

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'request_error',
    public details: string[] = [],
    public issues: Models['ApiIssue'][] = [],
  ) {
    super(message)
  }
}

const base = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

async function request<T>(
  path: string,
  init: RequestInit & { params?: QueryParams } = {},
): Promise<T> {
  const { params = {}, ...options } = init
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else if (value !== undefined) query.append(key, value)
  }
  const response = await fetch(`${base}${path}${query.size ? `?${query}` : ''}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Models['ErrorEnvelope'] | null
    throw new ApiError(
      response.status,
      payload?.error?.message ?? `API request failed (${response.status})`,
      payload?.error?.code,
      payload?.error?.details,
      payload?.error?.issues,
    )
  }
  return response.json() as Promise<T>
}

function get<T>(path: string, params: QueryParams = {}, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { params, signal })
}

function post<T>(path: string, body?: unknown, params: Record<string, string | undefined> = {}) {
  return request<T>(path, {
    method: 'POST',
    params,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const api = {
  resilienceCatalog: (body: Models['Binding']) =>
    post<Models['Catalog']>('/resilience/preventive/catalog', body),
  resilienceSimulate: (body: Models['EvaluationRequest']) =>
    post<Models['Evaluation']>('/resilience/preventive/simulate', body),
  resilienceOptimize: (body: Models['OptimizationRequest']) =>
    post<Models['Optimization']>('/resilience/preventive/optimize', body),
  resilienceStress: (body: Models['StressRequest']) =>
    post<Models['StressReport']>('/resilience/preventive/stress-test', body),
  intelligence: (context: Context, signal?: AbortSignal) =>
    get<Models['IntelligenceReport']>('/intelligence', context, signal),
  assessIntelligence: async (context: Context) => {
    const response = await fetch(`${base}/intelligence/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new ApiError(response.status, payload?.error?.message ?? 'Risk assessment failed')
    }
    return response.json() as Promise<Models['IntelligenceReport']>
  },
  vulnerabilityAssessment: (context: Context, signal?: AbortSignal) =>
    get<Models['VulnerabilityAssessment']>('/vulnerabilities/assessment', context, signal),
  vulnerabilityReferences: (signal?: AbortSignal) =>
    get<Models['ReferenceDataset']>('/vulnerabilities/references', {}, signal),
  health: (signal?: AbortSignal) => get<Models['Health']>('/health', {}, signal),
  scenarios: (signal?: AbortSignal) => get<Models['Scenario'][]>('/scenarios', {}, signal),
  snapshots: (context: Context, signal?: AbortSignal) =>
    get<Models['AssessmentSnapshot'][]>('/snapshots', { scenario_id: context.scenario_id }, signal),
  assets: (context: Context, signal?: AbortSignal) => get<Asset[]>('/assets', context, signal),
  asset: (id: string, context: Context, signal?: AbortSignal) =>
    get<Models['AssetDetail']>(`/assets/${encodeURIComponent(id)}`, context, signal),
  graph: (type: GraphMode, context: Context, signal?: AbortSignal) =>
    get<Models['CyberGraph'] | Models['OperationalGraph']>('/graph', { ...context, type }, signal),
  services: (context: Context, signal?: AbortSignal) =>
    get<Models['EssentialService'][]>('/services', context, signal),

  mlOverview: (signal?: AbortSignal) => get<Models['MlOverview']>('/ml/overview', {}, signal),
  mlScore: (cve_id: string) => get<Models['CveScore']>('/ml/score', { cve_id }),

  runSimulation: (context: Context, asOf?: string) =>
    post<SimulationRun>('/simulation/run', undefined, { ...context, as_of: asOf }),
  simulationProgress: (signal?: AbortSignal) =>
    get<Models['SimulationProgress']>('/simulation/progress', {}, signal),
  simulationDates: (signal?: AbortSignal) =>
    get<Models['SnapshotOption'][]>('/simulation/snapshots', {}, signal),
  products: (signal?: AbortSignal) => get<Models['ProductMap']>('/simulation/products', {}, signal),
  pooledBacktest: (signal?: AbortSignal) =>
    get<Models['PooledBacktest']>('/simulation/backtest', {}, signal),
  latestRun: async (signal?: AbortSignal): Promise<SimulationRun | null> => {
    try {
      return await get<SimulationRun>('/simulation/latest', {}, signal)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return null
      throw error
    }
  },
  attackPaths: (
    run: Pick<SimulationRun, 'id' | 'fingerprint' | 'scenario_id' | 'snapshot_id'>,
    isolated: string[],
    limit: number,
    signal?: AbortSignal,
  ) =>
    get<Models['AttackPathReport']>(
      '/simulation/attack-paths',
      {
        scenario_id: run.scenario_id,
        snapshot_id: run.snapshot_id,
        run_id: run.id,
        baseline_fingerprint: run.fingerprint,
        isolate: isolated,
        max_paths_per_target: String(limit),
      },
      signal,
    ),
  riskBrief: (context: Context, signal?: AbortSignal) =>
    get<Models['RiskBrief']>('/reports/brief', context, signal),
  actionOptions: (signal?: AbortSignal, runId?: string) =>
    get<Models['ActionOption'][]>('/actions/options', { run_id: runId }, signal),
  whatIf: (body: Models['WhatIfRequest']) => post<Models['WhatIfResult']>('/actions/what-if', body),
  optimize: (body: Models['OptimizeRequest']) =>
    post<Models['RemediationPlan']>('/actions/optimize', body),

  activity: (context: Context, signal?: AbortSignal) =>
    get<ActivityReport>('/activity', context, signal),
  assetActivity: (id: string, context: Context, signal?: AbortSignal) =>
    get<Models['AssetActivitySeries']>(
      `/activity/assets/${encodeURIComponent(id)}`,
      context,
      signal,
    ),
  vendors: (context: Context, signal?: AbortSignal) =>
    get<VendorReport>('/resilience/vendors', context, signal),
  chokepoints: (context: Context, signal?: AbortSignal) =>
    get<ChokepointReport>('/resilience/chokepoints', context, signal),
  attacker: (signal?: AbortSignal) => get<AttackerView>('/defense/attacker', {}, signal),
  prevention: (signal?: AbortSignal) => get<CutPlan>('/defense/prevention', {}, signal),
  reaction: (asset: string, signal?: AbortSignal) =>
    get<ReactionPlan>('/defense/reaction', { asset }, signal),
  trend: (context: Context, signal?: AbortSignal) =>
    get<PostureTrend>('/simulation/trend', context, signal),
  briefUrl: (format: 'md' | 'html' | 'pdf', context: Context) => {
    const query = new URLSearchParams({ format, scenario_id: context.scenario_id })
    if (context.snapshot_id) query.set('snapshot_id', context.snapshot_id)
    return `${base}/reports/brief?${query}`
  },
}
