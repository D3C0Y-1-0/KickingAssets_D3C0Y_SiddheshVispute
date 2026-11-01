import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type GraphMode } from '../api/client'

export function useScenario() {
  const query = useQuery({
    queryKey: ['scenarios'],
    queryFn: ({ signal }) => api.scenarios(signal),
  })
  return { ...query, scenario: query.data?.[0] }
}
export function useContext() {
  const { scenario } = useScenario()
  return { scenario_id: scenario?.id ?? '', snapshot_id: scenario?.current_snapshot_id }
}
export function useAssets() {
  const context = useContext()
  return useQuery({
    queryKey: ['assets', context],
    queryFn: ({ signal }) => api.assets(context, signal),
    enabled: !!context.scenario_id,
  })
}
export function useIntelligence() {
  const context = useContext()
  return useQuery({
    queryKey: ['intelligence', context],
    queryFn: ({ signal }) => api.intelligence(context, signal),
    enabled: !!context.scenario_id,
  })
}
export function useAsset(id: string | null) {
  const context = useContext()
  return useQuery({
    queryKey: ['asset', context, id],
    queryFn: ({ signal }) => api.asset(id!, context, signal),
    enabled: !!id && !!context.scenario_id,
  })
}
export function useGraph(mode: GraphMode) {
  const context = useContext()
  return useQuery({
    queryKey: ['graph', context, mode],
    queryFn: ({ signal }) => api.graph(mode, context, signal),
    enabled: !!context.scenario_id,
  })
}
export function useServices() {
  const context = useContext()
  return useQuery({
    queryKey: ['services', context],
    queryFn: ({ signal }) => api.services(context, signal),
    enabled: !!context.scenario_id,
  })
}
export function useSnapshots() {
  const context = useContext()
  return useQuery({
    queryKey: ['snapshots', context],
    queryFn: ({ signal }) => api.snapshots(context, signal),
    enabled: !!context.scenario_id,
  })
}

export function useMlOverview() {
  return useQuery({
    queryKey: ['ml', 'overview'],
    queryFn: ({ signal }) => api.mlOverview(signal),
    staleTime: 60_000,
  })
}
export function useLatestRun() {
  const context = useContext()
  const query = useQuery({
    queryKey: ['simulation', 'latest'],
    queryFn: ({ signal }) => api.latestRun(signal),
    staleTime: 15000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    select: (run) =>
      run && run.scenario_id === context.scenario_id && run.snapshot_id === context.snapshot_id
        ? run
        : null,
  })
  return { ...query, data: query.isError ? undefined : query.data }
}
export const RUN_MUTATION_KEY = ['simulation', 'run'] as const
export function useRunSimulation() {
  const client = useQueryClient()
  const context = useContext()
  return useMutation({
    mutationKey: RUN_MUTATION_KEY,
    mutationFn: (asOf?: string) => api.runSimulation(context, asOf),
    onSuccess: (run) => {
      client.setQueryData(['simulation', 'latest'], run)
      void client.invalidateQueries({ queryKey: ['asset'] })
      void client.invalidateQueries({ queryKey: ['actions'] })
    },
  })
}
export function useActionOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['actions', 'options'],
    queryFn: ({ signal }) => api.actionOptions(signal),
    enabled,
  })
}
export function useWhatIf() {
  return useMutation({ mutationFn: (body: Parameters<typeof api.whatIf>[0]) => api.whatIf(body) })
}
export function useOptimize() {
  return useMutation({
    mutationFn: (body: Parameters<typeof api.optimize>[0]) => api.optimize(body),
  })
}
export { useContext as useScenarioContext }

export function useSimulationDates() {
  return useQuery({
    queryKey: ['simulation', 'dates'],
    queryFn: ({ signal }) => api.simulationDates(signal),
    staleTime: Infinity,
  })
}
export function useProducts() {
  return useQuery({
    queryKey: ['simulation', 'products'],
    queryFn: ({ signal }) => api.products(signal),
    staleTime: Infinity,
  })
}
export function usePooledBacktest() {
  return useQuery({
    queryKey: ['simulation', 'pooled-backtest'],
    queryFn: ({ signal }) => api.pooledBacktest(signal),
    staleTime: Infinity,
    retry: false,
  })
}

/** Polls the backend while a run is in flight; each step is reported as the server finishes it. */
export function useSimulationProgress(active: boolean) {
  return useQuery({
    queryKey: ['simulation', 'progress'],
    queryFn: ({ signal }) => api.simulationProgress(signal),
    enabled: active,
    refetchInterval: active ? 100 : false,
    gcTime: 0,
  })
}
export function useActivity() {
  const context = useContext()
  return useQuery({
    queryKey: ['activity', context],
    queryFn: ({ signal }) => api.activity(context, signal),
    enabled: !!context.scenario_id,
  })
}
export function useAssetActivity(id: string | null) {
  const context = useContext()
  return useQuery({
    queryKey: ['activity', 'asset', context, id],
    queryFn: ({ signal }) => api.assetActivity(id!, context, signal),
    enabled: !!id && !!context.scenario_id,
  })
}
export function useVendors() {
  const context = useContext()
  return useQuery({
    queryKey: ['resilience', 'vendors', context],
    queryFn: ({ signal }) => api.vendors(context, signal),
    enabled: !!context.scenario_id,
    staleTime: Infinity,
  })
}
export function useChokepoints() {
  const context = useContext()
  return useQuery({
    queryKey: ['resilience', 'chokepoints', context],
    queryFn: ({ signal }) => api.chokepoints(context, signal),
    enabled: !!context.scenario_id,
    staleTime: Infinity,
  })
}
export function useTrend() {
  const context = useContext()
  return useQuery({
    queryKey: ['simulation', 'trend', context],
    queryFn: ({ signal }) => api.trend(context, signal),
    enabled: !!context.scenario_id,
    staleTime: Infinity,
  })
}
