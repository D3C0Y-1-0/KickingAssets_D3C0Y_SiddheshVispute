import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, FlaskConical, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useActionOptions, useLatestRun, useScenarioContext, useWhatIf } from '../../hooks/queries'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import { PageHeading, Panel, QueryState, RiskBadge, SectorBadge } from '../../components/ui'
import type { ActionType, Models } from '../../api/client'
import { useSoc } from '../soc/provider'
import IncidentAnalysis from '../soc/IncidentAnalysis'

type Staged = { asset_id: string; action_type: ActionType }

export default function WhatIf() {
  const latest = useLatestRun()
  const run = latest.data ?? null
  const options = useActionOptions(!!run)
  const context = useScenarioContext()
  const whatIf = useWhatIf()
  const [assetId, setAssetId] = useState('')
  const [staged, setStaged] = useState<Staged[]>([])
  const [params] = useSearchParams()
  const socEvent = params.get('soc_event')
  const { analysis, stale } = useSoc()
  const [edited, setEdited] = useState(false)
  const matching = !!socEvent && analysis?.data?.event_id === Number(socEvent)
  const candidate = analysis?.data
  const incidentData =
    matching &&
    candidate &&
    !stale &&
    candidate.run_id === run?.id &&
    candidate.baseline_fingerprint === run?.fingerprint
      ? candidate
      : null
  useEffect(() => {
    setEdited(false)
    setStaged(incidentData?.what_if_request?.actions ?? [])
    setAssetId(incidentData?.asset.asset_id ?? '')
    whatIf.reset()
    // Changing baseline/event clears previous staged incident actions and projections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socEvent, incidentData?.event_id, run?.id, run?.fingerprint])
  if (latest.isPending || latest.isError)
    return <QueryState pending={latest.isPending} error={latest.error} retry={latest.refetch} />
  if (!run)
    return (
      <>
        <PageHeading
          title="What-If"
          description="Stage preventive actions and see the projected change in risk."
        />
        <SimulationRequired />
        {socEvent && <IncidentAnalysis />}
      </>
    )
  const active = run.assets.find((a) => a.asset_id === assetId)
  const forAsset = (options.data ?? []).filter((o) => o.asset_id === assetId)
  const result =
    whatIf.data &&
    whatIf.data.run_id === run.id &&
    whatIf.data.baseline_fingerprint === run.fingerprint
      ? whatIf.data
      : !edited
        ? incidentData?.projection
        : null
  const change = (next: Staged[]) => {
    setEdited(true)
    setStaged(next)
    whatIf.reset()
  }
  const add = (action_type: ActionType) =>
    change(
      staged.some((s) => s.asset_id === assetId && s.action_type === action_type)
        ? staged
        : [...staged, { asset_id: assetId, action_type }],
    )
  const calculate = () =>
    whatIf.mutate({
      scenario_id: context.scenario_id,
      snapshot_id: context.snapshot_id ?? '',
      run_id: run?.id ?? '',
      baseline_fingerprint: run.fingerprint,
      actions: staged,
    } as Models['WhatIfRequest'])
  return (
    <>
      <PageHeading
        title="What-If"
        description="Stage the actions named in the problem statement and recompute the risk. Nothing is changed or verified."
        actions={
          <span className="badge neutral">
            <FlaskConical size={13} />
            PROJECTED · NOT VERIFIED
          </span>
        }
      />
      {socEvent && (
        <>
          <IncidentAnalysis />
          {!matching && (
            <p role="alert" className="callout">
              No retained automatic assessment for event #{socEvent} in this operator tab. Return to
              SOC Overview and reassess; no result is substituted.
            </p>
          )}
        </>
      )}
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
                {run.assets.map((a) => (
                  <option key={a.asset_id} value={a.asset_id}>
                    {a.asset_id} · {a.name} · {a.risk.score?.toFixed(1)}
                  </option>
                ))}
              </select>
              {active && (
                <div className="selected-asset-summary">
                  <SectorBadge sector={active.sector} />
                  <h3>{active.name}</h3>
                  <p>
                    <RiskBadge category={active.risk.category} /> score{' '}
                    <strong className="mono">{active.risk.score?.toFixed(1)}</strong> · S{' '}
                    {active.vulnerability_signal?.toFixed(2)} × E{' '}
                    {active.exposure_factor.toFixed(2)} × I′ {active.impact_factor.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </Panel>
          <Panel
            title="02 / Choose preventive actions"
            aside={<span className="subtle-label">FROM THE PROBLEM STATEMENT</span>}
            className="spaced-panel"
          >
            <div className="panel-padding">
              {!active ? (
                <div className="quiet-placeholder">Select a target to see its actions.</div>
              ) : options.isPending ? (
                <LoaderCircle className="spin" size={20} />
              ) : (
                forAsset.map((o) => {
                  const isStaged = staged.some(
                    (s) => s.asset_id === assetId && s.action_type === o.action_type,
                  )
                  return (
                    <div className="action-option" key={o.action_type}>
                      <div className="action-option-heading">
                        <h3>{o.name}</h3>
                        <span className={`badge ${o.modelled ? 'neutral' : 'sample'}`}>
                          {o.modelled ? 'MODELLED' : 'RECOMMENDATION ONLY'}
                        </span>
                      </div>
                      <p>{o.justification}</p>
                      <dl className="action-meta">
                        <dt>Effort</dt>
                        <dd>{o.effort_hours} h (planning assumption)</dd>
                        <dt>Operational considerations</dt>
                        <dd>{o.operational_disruption}</dd>
                        {o.modelled && o.applicable && o.city_reduction != null && (
                          <>
                            <dt>Projected city-index change</dt>
                            <dd className="mono">−{o.city_reduction.toFixed(2)}</dd>
                          </>
                        )}
                      </dl>
                      <button
                        className={`button ${isStaged ? 'secondary' : 'primary'}`}
                        disabled={isStaged || !o.applicable}
                        onClick={() => add(o.action_type)}
                      >
                        {isStaged ? <Check size={14} /> : <Plus size={14} />}
                        {!o.applicable ? 'Not applicable' : isStaged ? 'Staged' : 'Stage action'}
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
              {staged.length === 0 ? (
                <div className="quiet-placeholder">
                  Staged actions appear here. Nothing is executed.
                </div>
              ) : (
                staged.map((s) => (
                  <div className="staged-row" key={`${s.asset_id}-${s.action_type}`}>
                    <div>
                      <small className="mono mint">{s.asset_id}</small>
                      <strong>
                        {options.data?.find((o) => o.action_type === s.action_type)?.name ??
                          s.action_type}
                      </strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${s.action_type} for ${s.asset_id}`}
                      onClick={() => change(staged.filter((x) => x !== s))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
              <div className="comparison-grid">
                <div>
                  <span className="eyebrow">CURRENT CITY INDEX</span>
                  <strong>{(result?.current_city_index ?? run.city_risk.score)?.toFixed(1)}</strong>
                  <small>Computed baseline</small>
                </div>
                <ArrowRight size={20} />
                <div>
                  <span className="eyebrow">PROJECTED</span>
                  <strong>{result ? result.projected_city_index.toFixed(1) : '—'}</strong>
                  <small>
                    {result
                      ? `${result.city_reduction > 0 ? '−' : ''}${result.city_reduction.toFixed(2)} · not verified`
                      : 'Not calculated'}
                  </small>
                </div>
              </div>
              <button
                className="button primary full-width simulation-button"
                disabled={staged.length === 0 || whatIf.isPending}
                onClick={calculate}
              >
                {whatIf.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <FlaskConical size={16} />
                )}
                Calculate projected risk
              </button>
              {whatIf.isError && <p className="run-error">{whatIf.error.message}</p>}
              <p className="small muted">
                Current → projected does not imply verified. Verification needs independent evidence
                that a change was actually made.
              </p>
            </div>
          </Panel>
          {result && (
            <>
              <Panel title="Asset changes" className="spaced-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>ASSET</th>
                        <th>CURRENT</th>
                        <th>PROJECTED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.asset_deltas
                        .filter((d) => d.current_score !== d.projected_score)
                        .slice(0, 12)
                        .map((d) => (
                          <tr key={d.asset_id}>
                            <td>
                              {d.name} <small className="mono muted">{d.asset_id}</small>
                            </td>
                            <td>
                              <RiskBadge category={d.current_category} />{' '}
                              <span className="mono">{d.current_score.toFixed(1)}</span>
                            </td>
                            <td>
                              <RiskBadge category={d.projected_category} />{' '}
                              <span className="mono delta-down">
                                {d.projected_score.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Services: worst plausible disruption" className="spaced-panel">
                <div className="panel-padding">
                  {result.services_before.map((s, i) => (
                    <div className="bar-row" key={s.service_id}>
                      <span>{s.name}</span>
                      <span className="mono">
                        {(s.worst_disruption_fraction * 100).toFixed(0)}% →{' '}
                        {(result.services_after[i].worst_disruption_fraction * 100).toFixed(0)}%
                      </span>
                      <span />
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="What was applied" className="spaced-panel">
                <div className="panel-padding">
                  <ul className="list-plain">
                    {result.applied.map((a) => (
                      <li key={`${a.asset_id}-${a.action_type}`}>
                        <strong>
                          {a.asset_id} · {a.name}
                        </strong>
                        : {a.effect}
                      </li>
                    ))}
                    {result.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
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
