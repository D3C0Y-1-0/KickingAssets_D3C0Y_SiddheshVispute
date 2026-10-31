import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Models } from '../../api/client'
import { checkBaseline } from '../actions/useActionWorkflow'
import { baselineKey, binding, type Baseline } from '../actions/workflow'

function assertBinding(result: Models['Binding'], run: Baseline) {
  if (
    result.run_id !== run.id ||
    result.baseline_fingerprint !== run.fingerprint ||
    result.scenario_id !== run.scenario_id ||
    result.snapshot_id !== run.snapshot_id
  )
    throw new ApiError(
      409,
      'Resilience response belongs to another baseline. Check the latest simulation.',
      'baseline_mismatch',
    )
}
export function usePlannerCatalog(run: Baseline) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ['preventive', 'catalog', baselineKey(run)],
    retry: false,
    queryFn: async () => {
      const update = (value: Awaited<ReturnType<typeof api.latestRun>>) =>
        client.setQueryData(['simulation', 'latest'], value)
      await checkBaseline(run, update)
      const result = await api.resilienceCatalog(binding(run) as Models['Binding'])
      await checkBaseline(run, update)
      assertBinding(result, run)
      return result
    },
  })
}
type Request = Models['EvaluationRequest'] | Models['OptimizationRequest'] | Models['StressRequest']
type Response = Models['Evaluation'] | Models['Optimization'] | Models['StressReport']
export function usePlannerAction<T extends Request, R extends Response>(
  send: (body: T) => Promise<R>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ run, inputKey, body }: { run: Baseline; inputKey: string; body: T }) => {
      const update = (value: Awaited<ReturnType<typeof api.latestRun>>) =>
        client.setQueryData(['simulation', 'latest'], value)
      await checkBaseline(run, update)
      const result = await send(body)
      await checkBaseline(run, update)
      const evaluation = ('nominal' in result ? result.nominal : result) as Models['Evaluation']
      assertBinding(evaluation, run)
      if (
        evaluation.catalog_fingerprint !== body.catalog_fingerprint ||
        evaluation.comparison.before.horizon_minutes !== body.scenario.horizon_minutes ||
        evaluation.comparison.after.horizon_minutes !== body.scenario.horizon_minutes
      )
        throw new ApiError(
          409,
          'Resilience response context differs from the submitted scenario.',
          'scenario_mismatch',
        )
      const selected = evaluation.interventions.map((a) => a.id).sort()
      const submitted = [...(body.intervention_ids ?? [])].sort()
      if (
        new Set(selected).size !== selected.length ||
        selected.some((id) => !submitted.includes(id)) ||
        (!('budget_credits' in body) && JSON.stringify(selected) !== JSON.stringify(submitted))
      )
        throw new ApiError(
          409,
          'Returned interventions do not match the request.',
          'intervention_mismatch',
        )
      if (
        'budget_credits' in body &&
        (evaluation.cost_credits > body.budget_credits ||
          evaluation.effort_hours > body.effort_limit_hours ||
          evaluation.downtime_hours > body.downtime_limit_hours)
      )
        throw new ApiError(
          409,
          'Returned plan exceeds submitted planning limits.',
          'constraint_mismatch',
        )
      if (
        'cases' in result &&
        'cases' in body &&
        (result.cases.length !== body.cases.length ||
          result.cases.some(
            (c, i) =>
              c.case.id !== body.cases[i].id ||
              c.comparison.before.horizon_minutes !== body.scenario.horizon_minutes ||
              c.comparison.after.horizon_minutes !== body.scenario.horizon_minutes,
          ))
      )
        throw new ApiError(
          409,
          'Stress results do not match the submitted cases.',
          'scenario_mismatch',
        )
      return { result, inputKey }
    },
  })
}
