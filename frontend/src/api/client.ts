import type { components } from './schema'

export type Models = components['schemas']
export type Asset = Models['InfrastructureAsset']
export type Sector = Asset['sector']
export type GraphMode = 'cyber' | 'operational'
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
async function get<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
  const response = await fetch(`${base}${path}${query.size ? `?${query}` : ''}`, {
    signal,
    headers: { Accept: 'application/json' },
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

export const api = {
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
}
