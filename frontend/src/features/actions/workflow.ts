import type { Asset, ActionType, Models, SimulationRun } from '../../api/client'

export type StagedAction = Models['StagedActionRequest']
export type Baseline = Pick<
  SimulationRun,
  'id' | 'scenario_id' | 'snapshot_id' | 'created_at' | 'as_of'
>
export const actionNames: Record<ActionType, string> = {
  patch_prioritization: 'Patch prioritization',
  network_segmentation: 'Network segmentation',
  access_control: 'Access-control improvement',
  enhanced_monitoring: 'Enhanced monitoring',
  incident_response_plan: 'Incident-response planning',
}
export const actionKey = (action: { asset_id: string; action_type: string }) =>
  `${action.asset_id}:${action.action_type}`
export const baselineKey = (run: Baseline) =>
  JSON.stringify([run.scenario_id, run.snapshot_id, run.id, run.created_at, run.as_of])
export const identity = (run: Baseline): Baseline => ({
  id: run.id,
  scenario_id: run.scenario_id,
  snapshot_id: run.snapshot_id,
  created_at: run.created_at,
  as_of: run.as_of,
})
export const actionInputKey = (run: Baseline, actions: StagedAction[]) =>
  JSON.stringify([baselineKey(run), actions.map(actionKey).sort()])
export const planInputKey = (run: Baseline, budget: string, excluded: string[]) =>
  JSON.stringify([baselineKey(run), Number(budget), [...excluded].sort()])

export function validateBudget(value: string): string | null {
  const budget = Number(value)
  return value.trim() && Number.isFinite(budget) && budget > 0 && budget <= 10000
    ? null
    : 'Enter an effort budget greater than 0 and no more than 10,000 hours.'
}

export function validateExclusions(ids: string[], assets: Asset[]): string[] {
  const known = new Set(assets.map((a) => a.id))
  return ids.filter((id) => !known.has(id))
}

export function validateActions(
  actions: { asset_id: string; action_type: string }[],
  assets: { id: string }[],
): { supported: StagedAction[]; issues: string[] } {
  const known = new Set(assets.map((a) => a.id))
  const seen = new Set<string>()
  const supported: StagedAction[] = []
  const issues: string[] = []
  if (!actions.length) issues.push('Select at least one action.')
  if (actions.length > 40) issues.push('The current What-If API accepts at most 40 actions.')
  for (const action of actions) {
    const key = actionKey(action)
    if (!known.has(action.asset_id))
      issues.push(`Asset ${action.asset_id} is not in this scenario inventory.`)
    else if (!Object.hasOwn(actionNames, action.action_type))
      issues.push(
        `Action ${action.action_type} on ${action.asset_id} is not supported by the current What-If API.`,
      )
    else if (seen.has(key))
      issues.push(`Duplicate action ${action.action_type} on ${action.asset_id}.`)
    else
      supported.push({ asset_id: action.asset_id, action_type: action.action_type as ActionType })
    seen.add(key)
  }
  return { supported, issues }
}

/** Frontend navigation state only. This is deliberately not a new backend request schema. */
export type PlanHandoff = {
  kind: 'gridsentinel-plan-v1'
  baseline: Baseline
  actions: { asset_id: string; action_type: string }[]
}
export function makeHandoff(run: Baseline, actions: PlanHandoff['actions']): PlanHandoff {
  return { kind: 'gridsentinel-plan-v1', baseline: identity(run), actions }
}
export function readHandoff(value: unknown): { handoff: PlanHandoff | null; error: string | null } {
  if (value == null) return { handoff: null, error: null }
  const error = 'The Fix Plan handoff is invalid. Return to Fix Plan and select actions again.'
  if (typeof value !== 'object') return { handoff: null, error }
  const v = value as Partial<PlanHandoff>
  if (
    v.kind !== 'gridsentinel-plan-v1' ||
    !v.baseline ||
    !Array.isArray(v.actions) ||
    !['id', 'scenario_id', 'snapshot_id', 'created_at', 'as_of'].every(
      (key) => typeof (v.baseline as Record<string, unknown>)[key] === 'string',
    ) ||
    !v.actions.every(
      (a) => a && typeof a.asset_id === 'string' && typeof a.action_type === 'string',
    )
  )
    return { handoff: null, error }
  return { handoff: v as PlanHandoff, error: null }
}

export function relativeChange(baseline: number, projected: number): number | null {
  return baseline === 0 ? null : ((baseline - projected) / baseline) * 100
}
