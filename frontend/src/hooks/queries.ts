import { useQuery } from '@tanstack/react-query'
import { api, type GraphMode } from '../api/client'

export function useScenario() {
  const query = useQuery({
    queryKey: ['scenarios'],
    queryFn: ({ signal }) => api.scenarios(signal),
  })
  return { ...query, scenario: query.data?.[0] }
}
function useContext() {
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
