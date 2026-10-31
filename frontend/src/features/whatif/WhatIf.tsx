import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { useAssets, useScenarioContext } from '../../hooks/queries'
import type { Asset, SimulationRun, ActionType } from '../../api/client'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import { PageHeading, Panel, QueryState, RiskBadge, SectorBadge } from '../../components/ui'
import { useActionBaseline, useBoundOptions, useBoundWhatIf } from '../actions/useActionWorkflow'
import { BaselineNotice, Outdated, RiskComparison, WorkflowNav } from '../actions/WorkflowUI'
import {
  actionNames,
  actionKey,
  actionInputKey,
  baselineKey,
  identity,
  readHandoff,
  validateActions,
  type StagedAction,
} from '../actions/workflow'

export default function WhatIf() {
  const latest = useActionBaseline()
  const inventory = useAssets()
  const context = useScenarioContext()
  const location = useLocation()
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
          title="What-If lab"
          description="Stage preventive actions and compare their simulated effects."
        />
        <WorkflowNav current="whatif" />
        <SimulationRequired>
          Run a simulation for the selected inventory before comparing actions.
        </SimulationRequired>
      </>
    )
  return (
    <div className="workflow-scope">
      <WorkflowNav current="whatif" />
      <BaselineNotice run={run} refreshing={latest.isFetching} refresh={latest.refetch} />
      <WhatIfWorkspace
        key={location.key}
        run={run}
        assets={inventory.data}
        navigationState={location.state}
      />
    </div>
  )
}

function WhatIfWorkspace({
  run,
  assets,
  navigationState,
}: {
  run: SimulationRun
  assets: Asset[]
  navigationState: unknown
}) {
  const [incoming] = useState(() => readHandoff(navigationState))
  const [incomingIssues] = useState(() =>
    incoming.handoff ? validateActions(incoming.handoff.actions, assets).issues : [],
  )
  const [handoffDismissed, setHandoffDismissed] = useState(false)
  const [staged, setStaged] = useState<StagedAction[]>(() =>
    incoming.handoff && !incomingIssues.length
      ? validateActions(incoming.handoff.actions, assets).supported
      : [],
  )
  const [draftBaseline, setDraftBaseline] = useState(
    () => incoming.handoff?.baseline ?? identity(run),
  )
  const [assetId, setAssetId] = useState(() => staged[0]?.asset_id ?? '')
  const options = useBoundOptions(run)
  const whatIf = useBoundWhatIf()
  const knownIds = new Set(assets.map((asset) => asset.id))
  const orderedAssets = run.assets.filter((asset) => knownIds.has(asset.asset_id))
  const active = orderedAssets.find((asset) => asset.asset_id === assetId)
  const forAsset = (options.data ?? []).filter((option) => option.asset_id === assetId)
  const issues = validateActions(staged, assets).issues
  const baselineChanged = baselineKey(draftBaseline) !== baselineKey(run)
  const inputKey = actionInputKey(run, staged)
  const saved = whatIf.data
  const outdated =
    !!saved &&
    (saved.inputKey !== inputKey ||
      baselineKey(saved.baseline) !== baselineKey(run) ||
      baselineChanged)
  const result = outdated ? undefined : saved?.result
  const blockedHandoff = !handoffDismissed && (!!incoming.error || incomingIssues.length > 0)
  const names = new Map(assets.map((asset) => [asset.id, asset.name]))
  const add = (action_type: ActionType) => {
    if (
      baselineChanged ||
      !Object.hasOwn(actionNames, action_type) ||
      !knownIds.has(assetId) ||
      staged.length >= 40 ||
      staged.some((action) => action.asset_id === assetId && action.action_type === action_type)
    )
      return
    setStaged([...staged, { asset_id: assetId, action_type }])
  }
  const calculate = () => {
    if (issues.length || baselineChanged || blockedHandoff) return
    whatIf.mutate({
      baseline: run,
      inputKey,
      body: { scenario_id: run.scenario_id, snapshot_id: run.snapshot_id, actions: staged },
    })
  }
  const changedAssets =
    result?.asset_deltas.filter((delta) => delta.current_score !== delta.projected_score) ?? []
  const estimatedEffort = staged.reduce((sum, action) => {
    const option = options.data?.find((value) => actionKey(value) === actionKey(action))
    return option ? sum + option.effort_hours : sum
  }, 0)
  const effortKnown = staged.every((action) =>
    options.data?.some((value) => actionKey(value) === actionKey(action)),
  )
  return (
    <>
      <PageHeading
        title="What-If lab"
        description="Review staged preventive actions and calculate their simulated projection. No infrastructure changes are applied."
        actions={<span className="badge neutral">SIMULATED PROJECTION · NOT VERIFIED</span>}
      />
      {blockedHandoff && (
        <div className="callout warn" role="alert">
          <strong>Actions were not imported.</strong>
          <ul>
            {[...(incoming.error ? [incoming.error] : []), ...incomingIssues].map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <Link className="text-link" to="/remediation">
            Return to Fix Plan
          </Link>
          <div className="workflow-buttons">
            <button
              className="button secondary"
              onClick={() => {
                setHandoffDismissed(true)
                setStaged([])
                setDraftBaseline(identity(run))
              }}
            >
              Discard handoff and stage manually
            </button>
          </div>
        </div>
      )}
      {!blockedHandoff && incoming.handoff && !handoffDismissed && (
        <p className="callout" role="status">
          Actions imported from Fix Plan. Review them and calculate a new projection; importing does
          not execute anything.
        </p>
      )}
      {baselineChanged && (
        <div className="callout warn" role="alert">
          <strong>Staged baseline changed.</strong> These actions were staged for {draftBaseline.id}
          . Latest run: {run.id}. Review the actions before using this baseline.
          <div className="workflow-buttons">
            <button className="button secondary" onClick={() => setDraftBaseline(identity(run))}>
              Use latest baseline
            </button>
          </div>
        </div>
      )}
      {outdated && <Outdated subject="Projection" />}
      <div className="whatif-layout">
        <div>
          <Panel title="01 / Select a target asset">
            <div className="panel-padding">
              <label className="field-label" htmlFor="whatif-asset">
                Infrastructure asset (ordered by computed risk)
              </label>
              <select
                id="whatif-asset"
                className="full-width"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">Choose an asset…</option>
                {orderedAssets.map((asset) => (
                  <option key={asset.asset_id} value={asset.asset_id}>
                    {asset.asset_id} · {asset.name} ·{' '}
                    {asset.risk.score == null ? 'unavailable' : asset.risk.score.toFixed(1)}
                  </option>
                ))}
              </select>
              {active && (
                <div className="selected-asset-summary">
                  <SectorBadge sector={active.sector} />
                  <h3>{active.name}</h3>
                  <p>
                    <RiskBadge category={active.risk.category} /> score{' '}
                    <strong>{active.risk.score?.toFixed(1) ?? 'unavailable'}</strong> · S{' '}
                    {active.vulnerability_signal?.toFixed(2) ?? 'unavailable'} × E{' '}
                    {active.exposure_factor.toFixed(2)} × I′ {active.impact_factor.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </Panel>
          <Panel title="02 / Choose preventive actions" className="spaced-panel">
            <div className="panel-padding">
              {options.isError ? (
                <QueryState pending={false} error={options.error} retry={options.refetch} />
              ) : !active ? (
                <p className="quiet-placeholder">Select a target to see its actions.</p>
              ) : options.isPending ? (
                <p role="status">
                  <LoaderCircle className="spin" size={20} /> Loading action options…
                </p>
              ) : forAsset.length === 0 ? (
                <p role="status">No action options are available for this asset.</p>
              ) : (
                forAsset.map((option) => {
                  const isStaged = staged.some((action) => actionKey(action) === actionKey(option))
                  return (
                    <div className="action-option" key={option.action_type}>
                      <div className="action-option-heading">
                        <h3>{option.name}</h3>
                        <span className={`badge ${option.modelled ? 'neutral' : 'sample'}`}>
                          {option.modelled ? 'MODELLED' : 'RECOMMENDATION ONLY'}
                        </span>
                      </div>
                      <p>{option.justification}</p>
                      {!Object.hasOwn(actionNames, option.action_type) && (
                        <p className="run-error">
                          This action is not supported by the current What-If API. No action will be
                          staged.
                        </p>
                      )}
                      <dl className="action-meta">
                        <dt>Estimated effort</dt>
                        <dd>{option.effort_hours} h (planning assumption)</dd>
                        <dt>Operational considerations</dt>
                        <dd>{option.operational_disruption}</dd>
                        {option.modelled && option.applicable && option.city_reduction != null && (
                          <>
                            <dt>Individual projected city-index reduction</dt>
                            <dd>{option.city_reduction.toFixed(2)} points</dd>
                          </>
                        )}
                      </dl>
                      <button
                        className="button primary"
                        disabled={
                          isStaged ||
                          !option.applicable ||
                          !Object.hasOwn(actionNames, option.action_type) ||
                          baselineChanged ||
                          staged.length >= 40 ||
                          blockedHandoff
                        }
                        onClick={() => add(option.action_type)}
                      >
                        {!option.applicable
                          ? 'Not applicable'
                          : isStaged
                            ? 'Staged'
                            : 'Stage action'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </Panel>
        </div>
        <div>
          <Panel
            title="03 / Projected result"
            aside={<span className="badge neutral">{staged.length} STAGED</span>}
          >
            <div className="panel-padding">
              {staged.length === 0 && (
                <p className="quiet-placeholder">
                  Select at least one preventive action. Nothing will be executed.
                </p>
              )}
              {staged.map((action) => (
                <div className="staged-row" key={actionKey(action)}>
                  <div>
                    <small>
                      {action.asset_id} · {names.get(action.asset_id) ?? 'Not in current inventory'}
                    </small>
                    <strong>{actionNames[action.action_type]}</strong>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${action.action_type} for ${action.asset_id}`}
                    onClick={() =>
                      setStaged(staged.filter((value) => actionKey(value) !== actionKey(action)))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <p className="small muted">
                Staged effort:{' '}
                {effortKnown
                  ? `${estimatedEffort} h (planning assumption)`
                  : 'unavailable until action options load'}
                .
              </p>
              {staged.length > 0 && issues.length > 0 && (
                <ul className="workflow-issues" role="alert">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <button
                className="button primary full-width simulation-button"
                disabled={!!issues.length || baselineChanged || blockedHandoff || whatIf.isPending}
                onClick={calculate}
              >
                {whatIf.isPending
                  ? 'Calculating projection…'
                  : saved || whatIf.isError
                    ? 'Recalculate projected risk'
                    : 'Calculate projected risk'}
              </button>
              {whatIf.isPending && (
                <p role="status">Calculating against the checked simulation baseline…</p>
              )}
              {whatIf.isError && (
                <p className="run-error" role="alert">
                  {whatIf.error.message}
                </p>
              )}
              {!result && (
                <p className="small muted">
                  Baseline city index: {run.city_risk.score?.toFixed(2) ?? 'unavailable'}.{' '}
                  {outdated
                    ? 'Previous comparison hidden until recalculated.'
                    : 'Calculate to see a simulated comparison.'}
                </p>
              )}
              {result && (
                <RiskComparison
                  baseline={result.current_city_index}
                  projected={result.projected_city_index}
                  effort={result.applied.reduce((sum, action) => sum + action.effort_hours, 0)}
                />
              )}
              <p className="small muted">
                Patch batches assume remediation of up to three CVEs; fixed versions and vendor
                compatibility are not verified. Segmentation assumes full cyber isolation. Effort
                and controls are scenario assumptions.
              </p>
            </div>
          </Panel>
          {result && (
            <>
              <Panel title={`Affected assets (${changedAssets.length})`} className="spaced-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>ASSET</th>
                        <th>BASELINE</th>
                        <th>PROJECTED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changedAssets.map((delta) => (
                        <tr key={delta.asset_id}>
                          <td>
                            {delta.name}
                            <small>{delta.asset_id}</small>
                          </td>
                          <td>
                            <RiskBadge category={delta.current_category} />{' '}
                            {delta.current_score.toFixed(2)}
                          </td>
                          <td>
                            <RiskBadge category={delta.projected_category} />{' '}
                            {delta.projected_score.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!changedAssets.length && (
                    <p className="panel-padding">
                      No scored asset index changed under these actions.
                    </p>
                  )}
                </div>
              </Panel>
              <Panel title="Conditional essential-service impact" className="spaced-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>SERVICE</th>
                        <th>BASELINE DISRUPTION</th>
                        <th>PROJECTED DISRUPTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.services_before.map((service) => {
                        const after = result.services_after.find(
                          (value) => value.service_id === service.service_id,
                        )
                        return (
                          <tr key={service.service_id}>
                            <td>{service.name}</td>
                            <td>{(service.worst_disruption_fraction * 100).toFixed(1)}%</td>
                            <td>
                              {after
                                ? `${(after.worst_disruption_fraction * 100).toFixed(1)}%`
                                : 'unavailable'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="panel-footnote">
                  Worst plausible disruption under explicit compromise assumptions, not an outage
                  forecast. An unchanged service percentage can coexist with a lower risk index.
                </p>
              </Panel>
              <Panel title="Applied actions and assumptions" className="spaced-panel">
                <div className="panel-padding">
                  <ul className="list-plain">
                    {result.applied.map((action) => (
                      <li key={actionKey(action)}>
                        <strong>
                          {action.asset_id} · {action.name}
                        </strong>
                        : {action.effect} · {action.effort_hours} h
                      </li>
                    ))}
                    {result.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                  <small className="mono">
                    Simulation {result.run_id} · projected · not verified
                  </small>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
      <ProvenanceNotice />
    </>
  )
}
