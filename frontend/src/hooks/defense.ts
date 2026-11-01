import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useLatestRun } from './queries'

// These need a simulation run on the server, so they wait for one.
function useRunReady() {
  const run = useLatestRun()
  return { run, ready: !!run.data }
}
export function useAttacker() {
  const { ready } = useRunReady()
  return useQuery({
    queryKey: ['defense', 'attacker'],
    queryFn: ({ signal }) => api.attacker(signal),
    enabled: ready,
  })
}
export function usePrevention() {
  const { ready } = useRunReady()
  return useQuery({
    queryKey: ['defense', 'prevention'],
    queryFn: ({ signal }) => api.prevention(signal),
    enabled: ready,
  })
}
export function useReaction(asset: string | null) {
  const { ready } = useRunReady()
  return useQuery({
    queryKey: ['defense', 'reaction', asset],
    queryFn: ({ signal }) => api.reaction(asset ?? '', signal),
    enabled: ready && !!asset,
  })
}
export { useRunReady }
