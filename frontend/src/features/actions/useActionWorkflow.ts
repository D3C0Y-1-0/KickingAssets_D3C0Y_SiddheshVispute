import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { baselineKey, type Baseline } from './workflow'

/** Detect other tabs' runs as well as runs made through this application's query cache. */
export function useActionBaseline() {
  return useQuery({
    queryKey: ['simulation', 'latest'],
    queryFn: ({ signal }) => api.latestRun(signal),
    staleTime: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: false,
  })
}

export class BaselineChanged extends Error {
  constructor() {
    super('The simulation baseline changed. Review the latest baseline and recalculate.')
  }
}

/** Refresh the UI as well as enforcing the backend's exact run/fingerprint binding. */
export async function checkBaseline(
  expected: Baseline,
  update: (run: Awaited<ReturnType<typeof api.latestRun>>) => void,
) {
  const latest = await api.latestRun()
  update(latest)
  if (!latest || baselineKey(latest) !== baselineKey(expected)) throw new BaselineChanged()
}

export function useBoundOptions(run: Baseline) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ['actions', 'options', baselineKey(run)],
    queryFn: async () => {
      const update = (value: Awaited<ReturnType<typeof api.latestRun>>) =>
        client.setQueryData(['simulation', 'latest'], value)
      await checkBaseline(run, update)
      const options = await api.actionOptions(undefined, run.id)
      await checkBaseline(run, update)
      return options
    },
    retry: false,
  })
}

type BoundInput<T> = { baseline: Baseline; inputKey: string; body: T }
function useBoundAction<
  T,
  R extends {
    run_id: string
    scenario_id: string
    snapshot_id: string
    baseline_fingerprint: string
  },
>(send: (body: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ baseline, inputKey, body }: BoundInput<T>) => {
      const update = (value: Awaited<ReturnType<typeof api.latestRun>>) =>
        client.setQueryData(['simulation', 'latest'], value)
      await checkBaseline(baseline, update)
      const result = await send(body)
      await checkBaseline(baseline, update)
      if (
        result.run_id !== baseline.id ||
        result.scenario_id !== baseline.scenario_id ||
        result.snapshot_id !== baseline.snapshot_id ||
        result.baseline_fingerprint !== baseline.fingerprint
      )
        throw new BaselineChanged()
      return { result, baseline, inputKey }
    },
  })
}
export function useBoundWhatIf() {
  return useBoundAction(api.whatIf)
}
export function useBoundOptimize() {
  return useBoundAction(api.optimize)
}
