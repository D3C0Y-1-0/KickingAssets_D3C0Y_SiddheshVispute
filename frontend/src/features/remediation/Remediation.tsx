import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets, useScenarioContext } from '../../hooks/queries'
import type { Asset, SimulationRun } from '../../api/client'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import { EmptyState, PageHeading, Panel, QueryState } from '../../components/ui'
import { useActionBaseline, useBoundOptimize } from '../actions/useActionWorkflow'
import { BaselineNotice, Outdated, RiskComparison, WorkflowNav } from '../actions/WorkflowUI'
import { ActionError, ConstraintsEditor, PatchEvidence } from '../actions/ActionControls'
import {
  actionKey,
  actionNames,
  baselineKey,
  binding,
  constraintIssues,
  makeHandoff,
  planInputKey,
  validateActions,
  validateBudget,
  validateExclusions,
  selectPlanRequest,
  type Constraints,
} from '../actions/workflow'

export default function Remediation() {
  const latest = useActionBaseline()
  const inventory = useAssets()
  const context = useScenarioContext()
  if (latest.isPending || latest.isError || inventory.isPending || inventory.isError)
    return (
      <QueryState
        pending={latest.isPending || inventory.isPending}
        error={latest.error ?? inventory.error}
        retry={() => {
          void latest.refetch()
          void inventory.refetch()
        }}
      />
    )
  const run = latest.data
  if (!run || run.scenario_id !== context.scenario_id || run.snapshot_id !== context.snapshot_id)
    return (
      <>
        <PageHeading
          title="Remediation plan"
          description="Review assets, plan preventive actions and test their projected effects."
        />
        <WorkflowNav current="plan" />
        <SimulationRequired>
          Run a simulation for the selected inventory before planning.
        </SimulationRequired>
      </>
    )
  return (
    <div className="workflow-scope">
      <WorkflowNav current="plan" />
      <BaselineNotice run={run} refreshing={latest.isFetching} refresh={latest.refetch} />
      <PlanWorkspace run={run} assets={inventory.data} />
    </div>
  )
}

function PlanWorkspace({ run, assets }: { run: SimulationRun; assets: Asset[] }) {
  const navigate = useNavigate()
  const optimize = useBoundOptimize()
  const [budget, setBudget] = useState('60')
  const [excluded, setExcluded] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [constraints, setConstraints] = useState<Constraints | null>(null)
  const invalidConstraints = constraintIssues(constraints)
  const budgetError = validateBudget(budget)
  const unknown = validateExclusions(excluded, assets)
  const key = planInputKey(run, budget, excluded, constraints)
  const saved = optimize.data
  const outdated =
    !!saved && (saved.inputKey !== key || baselineKey(saved.baseline) !== baselineKey(run))
  const plan = outdated ? undefined : saved?.result
  const returnedExcluded = plan?.steps.filter((step) => excluded.includes(step.asset_id)) ?? []
  const integrityError = returnedExcluded.length > 0
  const visibleSteps = integrityError ? [] : (plan?.steps ?? [])
  const fullSelection = plan ? selectPlanRequest(plan, visibleSteps.map(actionKey)) : null
  const validation = validateActions(fullSelection?.request?.actions ?? [], assets)
  const handoffIssues = [...validation.issues, ...(fullSelection?.issues ?? [])]
  const selectedSteps = visibleSteps.filter((step) => selected.includes(actionKey(step)))
  const subsetSelection = plan ? selectPlanRequest(plan, selectedSteps.map(actionKey)) : null
  const selectedValidation = validateActions(subsetSelection?.request?.actions ?? [], assets)
  const matches = assets.filter((asset) =>
    `${asset.id} ${asset.name} ${asset.site}`.toLowerCase().includes(search.toLowerCase()),
  )
  const send = () => {
    if (budgetError || unknown.length || invalidConstraints.length) return
    setSelected([])
    optimize.mutate({
      baseline: run,
      inputKey: key,
      body: {
        ...binding(run),
        effort_budget_hours: Number(budget),
        excluded_asset_ids: excluded,
        constraints,
      },
    })
  }
  const handoff = (steps: typeof visibleSteps) => {
    if (!plan || outdated || integrityError || validateActions(steps, assets).issues.length) return
    const selection = selectPlanRequest(plan, steps.map(actionKey))
    if (
      !selection.request ||
      selection.issues.length ||
      validateActions(selection.request.actions, assets).issues.length
    )
      return
    navigate('/what-if', {
      state: makeHandoff(run, selection.request.actions, selection.request.constraints ?? null),
    })
  }
  return (
    <>
      <PageHeading
        title="Remediation plan"
        description="Choose a planning budget and protected assets. Review the greedy plan, then simulate selected actions in What-If."
      />
      <Panel title="Planning inputs" className="workflow-form">
        <div className="panel-padding">
          <label htmlFor="budget">Effort budget (hours)</label>
          <input
            id="budget"
            type="number"
            min="0.01"
            max="10000"
            step="any"
            value={budget}
            aria-invalid={!!budgetError}
            aria-describedby={budgetError ? 'budget-error' : undefined}
            onChange={(e) => setBudget(e.target.value)}
          />
          {budgetError && (
            <p id="budget-error" className="run-error" role="alert">
              {budgetError}
            </p>
          )}
          <label htmlFor="exclusion-search">Search assets to exclude</label>
          <input
            id="exclusion-search"
            type="search"
            placeholder="Name, ID or site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="small muted">
            Excluded assets cannot be recommended targets. Other assets may still depend on them.
          </p>
          <div className="workflow-checklist" role="group" aria-label="Asset exclusions">
            {matches.map((asset) => (
              <label key={asset.id}>
                <input
                  type="checkbox"
                  checked={excluded.includes(asset.id)}
                  onChange={(e) =>
                    setExcluded(
                      e.target.checked
                        ? [...excluded, asset.id]
                        : excluded.filter((id) => id !== asset.id),
                    )
                  }
                />
                Exclude {asset.id} · {asset.name}
              </label>
            ))}
            {!matches.length && <p role="status">No inventory assets match this search.</p>}
          </div>
          <div className="workflow-exclusions" aria-label="Selected exclusions">
            {excluded.length ? (
              excluded.map((id) => (
                <span className="workflow-chip" key={id}>
                  {id}
                  <button
                    className="button secondary"
                    aria-label={`Remove exclusion ${id}`}
                    onClick={() => setExcluded(excluded.filter((value) => value !== id))}
                  >
                    Remove
                  </button>
                </span>
              ))
            ) : (
              <span className="small muted">No assets excluded</span>
            )}
          </div>
          {unknown.length > 0 && (
            <p className="run-error" role="alert">
              Remove exclusions missing from this inventory: {unknown.join(', ')}.
            </p>
          )}
          <ConstraintsEditor value={constraints} onChange={setConstraints} />
          <p className="small muted">
            Effort and downtime are planning assumptions. The optimizer uses documented fixes; use
            What-If to evaluate a specific target version.
          </p>
          <div className="workflow-buttons">
            <button
              className="button primary"
              disabled={
                !!budgetError ||
                unknown.length > 0 ||
                !!invalidConstraints.length ||
                optimize.isPending
              }
              onClick={send}
            >
              {optimize.isPending
                ? 'Calculating plan…'
                : saved || optimize.isError
                  ? 'Recalculate Plan'
                  : 'Generate plan'}
            </button>
          </div>
        </div>
      </Panel>
      {outdated && <Outdated subject="Plan" />}
      {optimize.isPending && (
        <p role="status">Calculating a simulated plan and checking its baseline…</p>
      )}
      {optimize.isError && <ActionError error={optimize.error} />}
      {integrityError && (
        <p className="run-error" role="alert">
          The API returned an excluded target. This plan is blocked; recalculate or review the
          backend contract.
        </p>
      )}
      {!integrityError && plan && (
        <>
          <RiskComparison
            baseline={plan.starting_city_index}
            projected={plan.ending_city_index}
            effort={plan.used_hours}
          />
          <p className="small muted">
            {plan.steps.length} prioritized actions · {plan.used_hours} of{' '}
            {plan.effort_budget_hours} h used · simulation {plan.run_id}
          </p>
          <p className="small muted">
            Modelled downtime: {plan.used_downtime_hours} h · greedy heuristic, not a proven
            optimum. Selected transfers include any required prerequisite actions.
          </p>
        </>
      )}
      <Panel
        title="Prioritized preventive actions"
        aside={
          <span className="badge neutral">
            {outdated
              ? 'OUTDATED'
              : integrityError
                ? 'BLOCKED'
                : plan
                  ? 'SIMULATED PROJECTION'
                  : 'NOT GENERATED'}
          </span>
        }
        className="spaced-panel"
      >
        {!plan || integrityError ? (
          <EmptyState
            title={outdated ? 'Recalculate the outdated plan' : 'Generate a plan to review actions'}
          >
            Only a plan matching the current inputs and baseline can be sent to What-If.
          </EmptyState>
        ) : visibleSteps.length === 0 ? (
          <EmptyState title="No beneficial action fits these inputs">
            Review the budget and exclusions. The cheapest modelled action requires 8 hours.
          </EmptyState>
        ) : (
          <>
            <div className="panel-padding workflow-buttons">
              <button
                className="button primary"
                disabled={!!handoffIssues.length}
                onClick={() => handoff(visibleSteps)}
              >
                Simulate full plan in What-If
              </button>
              <button
                className="button secondary"
                disabled={!!selectedValidation.issues.length || !!subsetSelection?.issues.length}
                onClick={() => handoff(selectedSteps)}
              >
                Simulate selected actions in What-If ({selectedSteps.length})
              </button>
            </div>
            {handoffIssues.length > 0 && (
              <ul className="workflow-issues" role="alert">
                {handoffIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SELECT</th>
                    <th>ACTION / TARGET</th>
                    <th>EFFORT</th>
                    <th>MARGINAL REDUCTION</th>
                    <th>CITY INDEX AFTER</th>
                    <th>CONSIDERATIONS</th>
                    <th>WHAT-IF</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSteps.map((step) => {
                    const rowSelection = selectPlanRequest(plan, [actionKey(step)])
                    const issue = [
                      ...validateActions([step], assets).issues,
                      ...validateActions(rowSelection.request?.actions ?? [], assets).issues,
                      ...rowSelection.issues,
                    ]
                    return (
                      <tr key={actionKey(step)}>
                        <td>
                          <label className="workflow-selection">
                            <input
                              type="checkbox"
                              aria-label={`Select ${step.name} for ${step.asset_id}`}
                              disabled={!!issue.length}
                              checked={selected.includes(actionKey(step))}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, actionKey(step)]
                                    : selected.filter((id) => id !== actionKey(step)),
                                )
                              }
                            />
                            {step.rank}
                          </label>
                        </td>
                        <td>
                          <strong>{step.name}</strong>
                          {step.kind === 'prerequisite' && (
                            <small>Prerequisite for {step.prerequisite_for}</small>
                          )}
                          <small>
                            {step.asset_name} · {step.asset_id}
                          </small>
                          <small className="muted">{step.justification}</small>
                          <PatchEvidence patch={step.patch} />
                          {issue.map((message) => (
                            <p key={message} className="run-error">
                              {message}
                            </p>
                          ))}
                        </td>
                        <td>
                          {step.effort_hours} h effort
                          <small>{step.downtime_hours} h downtime</small>
                        </td>
                        <td>{step.marginal_reduction.toFixed(2)} points</td>
                        <td>{step.city_index_after.toFixed(2)}</td>
                        <td>{step.operational_disruption}</td>
                        <td>
                          <button
                            className="button secondary"
                            aria-label={`Simulate ${step.name} for ${step.asset_id} in What-If`}
                            disabled={!!issue.length}
                            onClick={() => handoff([step])}
                          >
                            Simulate in What-If
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {plan && !integrityError && <p className="panel-footnote">{plan.method}</p>}
      </Panel>
      {plan && !integrityError && plan.recommendation_only.length > 0 && (
        <Panel
          title="Recommendations without a modelled reduction"
          className="spaced-panel"
          aside={<span className="badge sample">OUTSIDE THE OPTIMIZED EFFORT BUDGET</span>}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ACTION</th>
                  <th>ASSET</th>
                  <th>EFFORT</th>
                  <th>WHY</th>
                </tr>
              </thead>
              <tbody>
                {plan.recommendation_only
                  .filter((option) => !excluded.includes(option.asset_id))
                  .map((option) => (
                    <tr key={actionKey(option)}>
                      <td>{option.name}</td>
                      <td>
                        {option.asset_name} · {option.asset_id}
                      </td>
                      <td>{option.effort_hours} h</td>
                      <td>{option.justification}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="panel-footnote">
            These recommendations are separate from selected plan steps. No detection or recovery
            benefit is included in the risk formula.
          </p>
        </Panel>
      )}
      {plan && !integrityError && (
        <Panel title="Planning limits and unselected candidates" className="spaced-panel">
          <div className="panel-padding">
            <ul>
              {plan.limitations.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
            <details>
              <summary>Why candidates were not selected ({plan.rejected.length})</summary>
              <ul>
                {plan.rejected.map((candidate) => (
                  <li key={actionKey(candidate)}>
                    <strong>
                      {candidate.asset_id} · {actionNames[candidate.action_type]}
                    </strong>{' '}
                    · {candidate.reason_code}: {candidate.reason}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </Panel>
      )}
      <ProvenanceNotice />
    </>
  )
}
