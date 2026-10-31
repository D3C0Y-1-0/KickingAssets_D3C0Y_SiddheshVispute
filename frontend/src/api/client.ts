import type { components } from './schema'

export type Models = components['schemas']
export type Asset = Models['InfrastructureAsset']
export type Sector = Asset['sector']
export type GraphMode = 'cyber' | 'operational'
export type SimulationRun = Models['SimulationRun']
export type AssetSimulation = Models['AssetSimulation']
export type ActionType = Models['ActionDefinition']['type']
type Context = { scenario_id: string; snapshot_id?: string }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const base = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

async function request<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string | undefined> } = {},
): Promise<T> {
  const { params = {}, ...options } = init
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
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
    )
  }
  return response.json() as Promise<T>
}

function get<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
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
  actionOptions: (signal?: AbortSignal) =>
    get<Models['ActionOption'][]>('/actions/options', {}, signal),
  whatIf: (body: Models['WhatIfRequest']) => post<Models['WhatIfResult']>('/actions/what-if', body),
  optimize: (body: Models['OptimizeRequest']) =>
    post<Models['RemediationPlan']>('/actions/optimize', body),
}
