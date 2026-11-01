import { useState } from 'react'
import { CheckCheck, ListChecks, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLatestRun, useOptimize, useScenarioContext } from '../../hooks/queries'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import { EmptyState, PageHeading, Panel, QueryState } from '../../components/ui'

export default function Remediation() {
  const latest = useLatestRun()
  const context = useScenarioContext()
  const optimize = useOptimize()
  const [budget, setBudget] = useState(60)
  if (latest.isPending || latest.isError)
    return <QueryState pending={latest.isPending} error={latest.error} retry={latest.refetch} />
  const run = latest.data
  if (!run)
    return (
      <>
        <PageHeading
          title="Fix plan"
          description="Make the next action count. Prioritize reduction, effort and operational feasibility."
        />
        <SimulationRequired />
      </>
    )
  const plan = optimize.data
  return (
    <>
      <PageHeading
        title="Fix plan"
        description="A greedy plan: the action with the best city-index reduction per effort hour is picked, then everything is recomputed."
        actions={
          <>
            <label className="field-label" htmlFor="budget">
              Effort budget (hours)
            </label>
            <input
              id="budget"
              type="number"
              min={1}
              max={1000}
              value={budget}
              onChange={(e) => setBudget(Math.max(1, Number(e.target.value)))}
              style={{ width: 90 }}
            />
            <button
              className="button primary"
              disabled={optimize.isPending}
              onClick={() =>
                optimize.mutate({
                  scenario_id: context.scenario_id,
                  snapshot_id: context.snapshot_id ?? '',
                  run_id: run?.id ?? '',
                  effort_budget_hours: budget,
                  excluded_asset_ids: [],
                })
              }
            >
              {optimize.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ListChecks size={16} />
              )}
              Generate plan
            </button>
          </>
        }
      />
      {optimize.isError && <p className="run-error">{optimize.error.message}</p>}
      <div className="metric-grid three-metrics">
        <section className="metric-card">
          <div className="metric-label">
            Prioritized actions
            <ListChecks size={16} />
          </div>
          <div className="metric-value">{plan ? plan.steps.length : '—'}</div>
          <div className="metric-foot">
            {plan ? `${plan.used_hours} of ${plan.effort_budget_hours} h used` : 'Generate a plan'}
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Projected city index
            <CheckCheck size={16} />
          </div>
          <div className="metric-value">
            {plan
              ? `${plan.starting_city_index.toFixed(1)} → ${plan.ending_city_index.toFixed(1)}`
              : (run.city_risk.score?.toFixed(1) ?? '—')}
          </div>
          <div className="metric-foot">Projected · not verified</div>
        </section>
        <section className="metric-card">
          <div className="metric-label">Estimated effort</div>
          <div className="metric-value">{plan ? `${plan.used_hours} h` : '—'}</div>
          <div className="metric-foot">Planning assumptions per action type</div>
        </section>
      </div>
      <Panel
        title="Prioritized preventive actions"
        aside={<span className="badge neutral">{plan ? 'COMPUTED' : 'NOT GENERATED'}</span>}
      >
        {plan ? (
          plan.steps.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ACTION</th>
                    <th>TARGET ASSET</th>
                    <th>EFFORT</th>
                    <th>MARGINAL REDUCTION</th>
                    <th>CITY INDEX AFTER</th>
                    <th>CONSIDERATIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.steps.map((s) => (
                    <tr key={s.rank}>
                      <td className="mono">{s.rank}</td>
                      <td>
                        <strong>{s.name}</strong>
                        <small className="muted">{s.justification}</small>
                      </td>
                      <td>
                        {s.asset_name} <small className="mono muted">{s.asset_id}</small>
                      </td>
                      <td className="mono">{s.effort_hours} h</td>
                      <td className="mono delta-down">−{s.marginal_reduction.toFixed(2)}</td>
                      <td className="mono">{s.city_index_after.toFixed(1)}</td>
                      <td className="small">{s.operational_disruption}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No action fits this budget">
              Increase the effort budget; the cheapest modelled action needs 8 hours.
            </EmptyState>
          )
        ) : (
          <EmptyState title="Set a budget and generate the plan">
            The plan uses the same computed scores as the rest of the workflow.
          </EmptyState>
        )}
        {plan && <div className="panel-footnote">{plan.method}</div>}
      </Panel>
      {plan && plan.recommendation_only.length > 0 && (
        <Panel
          title="Recommendations without a modelled reduction"
          aside={<span className="badge sample">NO RISK-INDEX EFFECT CLAIMED</span>}
          className="spaced-panel"
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
                {plan.recommendation_only.map((o) => (
                  <tr key={`${o.asset_id}-${o.action_type}`}>
                    <td>
                      <strong>{o.name}</strong>
                    </td>
                    <td>
                      {o.asset_name} <small className="mono muted">{o.asset_id}</small>
                    </td>
                    <td className="mono">{o.effort_hours} h</td>
                    <td className="small">{o.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <div className="centered-action">
        <Link to="/what-if" className="button secondary">
          Open What-If
        </Link>
      </div>
      <ProvenanceNotice />
    </>
  )
}
