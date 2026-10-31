import type { Asset, ActionType, Models, SimulationRun } from '../../api/client'

export type StagedAction = Models['StagedActionRequest']
export type Constraints = Models['OperationalConstraints']
export type Baseline = Pick<
  SimulationRun,
  'id' | 'scenario_id' | 'snapshot_id' | 'created_at' | 'as_of' | 'fingerprint'
>
type IncomingAction = {
  asset_id: string
  action_type: string
  cve_ids?: string[] | null
  target_version?: string | null
}
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
  JSON.stringify([
    run.scenario_id,
    run.snapshot_id,
    run.id,
    run.created_at,
    run.as_of,
    run.fingerprint,
  ])
export const identity = (run: Baseline): Baseline => ({
  id: run.id,
  scenario_id: run.scenario_id,
  snapshot_id: run.snapshot_id,
  created_at: run.created_at,
  as_of: run.as_of,
  fingerprint: run.fingerprint,
})
export const binding = (
  run: Baseline,
): Pick<
  Models['WhatIfRequest'],
  'scenario_id' | 'snapshot_id' | 'run_id' | 'baseline_fingerprint'
> => ({
  scenario_id: run.scenario_id,
  snapshot_id: run.snapshot_id,
  run_id: run.id,
  baseline_fingerprint: run.fingerprint,
})
export const actionInputKey = (
  run: Baseline,
  actions: StagedAction[],
  constraints: Constraints | null = null,
) => JSON.stringify([baselineKey(run), actions, constraints])
export const planInputKey = (
  run: Baseline,
  budget: string,
  excluded: string[],
  constraints: Constraints | null = null,
) => JSON.stringify([baselineKey(run), Number(budget), [...excluded].sort(), constraints])
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
  actions: IncomingAction[],
  assets: { id: string }[],
): { supported: StagedAction[]; issues: string[] } {
  const known = new Set(assets.map((a) => a.id)),
    seen = new Set<string>()
  const supported: StagedAction[] = [],
    issues: string[] = []
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
    else {
      if (
        action.action_type !== 'patch_prioritization' &&
        (action.cve_ids || action.target_version)
      )
        issues.push(`Patch parameters apply only to patch prioritization on ${action.asset_id}.`)
      if (
        action.cve_ids != null &&
        (!action.cve_ids.length ||
          action.cve_ids.length > 25 ||
          action.cve_ids.some((id) => !/^CVE-\d{4}-\d{4,}$/.test(id)) ||
          new Set(action.cve_ids).size !== action.cve_ids.length)
      )
        issues.push(
          `Use 1–25 distinct valid CVE IDs for ${action.asset_id}, or leave blank for the documented-fix batch.`,
        )
      if (
        action.target_version != null &&
        (!action.target_version.trim() || action.target_version.length > 64)
      )
        issues.push(`Enter a target version of 1–64 characters for ${action.asset_id}.`)
      supported.push({
        asset_id: action.asset_id,
        action_type: action.action_type as ActionType,
        ...(Object.hasOwn(action, 'cve_ids')
          ? { cve_ids: action.cve_ids == null ? null : [...action.cve_ids] }
          : {}),
        ...(Object.hasOwn(action, 'target_version')
          ? { target_version: action.target_version ?? null }
          : {}),
      })
    }
    seen.add(key)
  }
  return { supported, issues }
}

export function constraintIssues(value: Constraints | null): string[] {
  if (!value) return []
  const issues: string[] = []
  const window = value.max_downtime_per_action_hours,
    total = value.max_total_downtime_hours
  if (window != null && (!Number.isFinite(window) || window <= 0 || window > 1000))
    issues.push(
      'The single-action maintenance window must be greater than 0 and at most 1,000 hours.',
    )
  if (total != null && (!Number.isFinite(total) || total < 0 || total > 100000))
    issues.push('Total downtime must be between 0 and 100,000 hours.')
  return issues
}
/** Versioned frontend navigation state; preserves parameters and constraints from the server. */
export type PlanHandoff = {
  kind: 'gridsentinel-plan-v2'
  baseline: Baseline
  actions: IncomingAction[]
  constraints: Constraints | null
}
export function makeHandoff(
  run: Baseline,
  actions: IncomingAction[],
  constraints: Constraints | null = null,
): PlanHandoff {
  return { kind: 'gridsentinel-plan-v2', baseline: identity(run), actions, constraints }
}
export function readHandoff(value: unknown): { handoff: PlanHandoff | null; error: string | null } {
  if (value == null) return { handoff: null, error: null }
  const error = 'The Fix Plan handoff is invalid. Return to Fix Plan and select actions again.'
  if (typeof value !== 'object') return { handoff: null, error }
  const v = value as Partial<PlanHandoff>
  if (
    v.kind !== 'gridsentinel-plan-v2' ||
    !v.baseline ||
    !Array.isArray(v.actions) ||
    !['id', 'scenario_id', 'snapshot_id', 'created_at', 'as_of', 'fingerprint'].every(
      (key) => typeof (v.baseline as Record<string, unknown>)[key] === 'string',
    ) ||
    !v.actions.every(
      (a) =>
        a &&
        typeof a.asset_id === 'string' &&
        typeof a.action_type === 'string' &&
        (a.cve_ids == null ||
          (Array.isArray(a.cve_ids) && a.cve_ids.every((id) => typeof id === 'string'))) &&
        (a.target_version == null || typeof a.target_version === 'string'),
    )
  )
    return { handoff: null, error }
  if (v.constraints != null) {
    const c = v.constraints
    if (
      typeof c !== 'object' ||
      ![c.max_downtime_per_action_hours, c.max_total_downtime_hours].every(
        (n) => n == null || typeof n === 'number',
      ) ||
      (c.incompatible != null &&
        (!Array.isArray(c.incompatible) ||
          !c.incompatible.every(
            (p) => p && Object.hasOwn(actionNames, p.first) && Object.hasOwn(actionNames, p.second),
          ))) ||
      (c.prerequisites != null &&
        (!Array.isArray(c.prerequisites) ||
          !c.prerequisites.every(
            (p) =>
              p && Object.hasOwn(actionNames, p.action) && Object.hasOwn(actionNames, p.requires),
          )))
    )
      return { handoff: null, error }
  }
  return { handoff: { ...v, constraints: v.constraints ?? null } as PlanHandoff, error: null }
}

/** Select from the authoritative handoff, retaining required prerequisite actions and order. */
export function selectPlanRequest(
  plan: Models['RemediationPlan'],
  keys: string[],
): { request: Models['WhatIfRequest'] | null; issues: string[] } {
  const full = plan.what_if_request
  if (!full)
    return { request: null, issues: ['The backend supplied no What-If request for this plan.'] }
  if (
    full.run_id !== plan.run_id ||
    full.baseline_fingerprint !== plan.baseline_fingerprint ||
    full.scenario_id !== plan.scenario_id ||
    full.snapshot_id !== plan.snapshot_id
  )
    return {
      request: null,
      issues: ['The backend plan and handoff have different baseline identities.'],
    }
  const chosen = new Set(keys),
    issues: string[] = []
  const available = new Map(full.actions.map((a) => [actionKey(a), a]))
  if (
    available.size !== full.actions.length ||
    plan.steps.length !== full.actions.length ||
    plan.steps.some((step) => !available.has(actionKey(step)))
  )
    issues.push('The backend steps and handoff actions are inconsistent; regenerate the plan.')
  for (const key of chosen)
    if (!available.has(key)) issues.push(`The server handoff has no action ${key}.`)
  let added = true
  while (added) {
    added = false
    for (const action of full.actions)
      if (chosen.has(actionKey(action)))
        for (const rule of full.constraints?.prerequisites ?? [])
          if (rule.action === action.action_type) {
            const needed = `${action.asset_id}:${rule.requires}`
            if (!available.has(needed))
              issues.push(`Missing prerequisite ${needed}; this selection cannot be simulated.`)
            else if (!chosen.has(needed)) {
              chosen.add(needed)
              added = true
            }
          }
  }
  return {
    request: { ...full, actions: full.actions.filter((a) => chosen.has(actionKey(a))) },
    issues: [...new Set(issues)],
  }
}
export function relativeChange(baseline: number, projected: number): number | null {
  return baseline === 0 ? null : ((baseline - projected) / baseline) * 100
}
