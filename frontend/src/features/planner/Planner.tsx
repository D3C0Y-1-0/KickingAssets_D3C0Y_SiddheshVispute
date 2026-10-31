import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Models, type SimulationRun } from '../../api/client'
import { useGraph, useLatestRun } from '../../hooks/queries'
import { SimulationRequired } from '../../components/Simulation'
import { PageHeading, Panel, QueryState } from '../../components/ui'
import { BaselineNotice, Outdated } from '../actions/WorkflowUI'
import { ActionError } from '../actions/ActionControls'
import { baselineKey, binding } from '../actions/workflow'
import { usePlannerAction, usePlannerCatalog } from './queries'
import { minutesLost, numericIssue, type Outcome } from './model'
import { Replay, ServiceComparison } from './Replay'
import './planner.css'

export default function Planner() {
  const latest = useLatestRun()
  const previous = useRef<string | null>(null)
  const [changed, setChanged] = useState(false)
  const run = latest.data
  useEffect(() => {
    if (!run) return
    const key = baselineKey(run)
    if (previous.current && previous.current !== key) setChanged(true)
    previous.current = key
  }, [run])
  return (
    <div className="workflow-scope planner-page">
      <PageHeading
        title="Resilience planner"
        description="Simulate conditional service failures, review preventive measures and replay projected outcomes. No infrastructure changes are applied."
      />
      <nav className="workflow-nav" aria-label="Resilience review workflow">
        <Link to="/live">Live Simulation</Link>
        <Link to="/assets">Assets &amp; Risk</Link>
        <Link to="/infrastructure?mode=operational">Operational map</Link>
        <Link to="/remediation">Risk Fix Plan</Link>
      </nav>
      <p className="callout warn">
        <strong>Simulated infrastructure · projected, not verified.</strong> Service-disruption
        minutes are conditional on authored failure, backup and recovery assumptions. They are not
        incident probabilities or the city risk index.
      </p>
      {changed && (
        <p className="callout warn" role="status">
          Simulation baseline changed. Previous planner results were cleared; review inputs before
          calculating again.
        </p>
      )}
      {latest.isPending || latest.isError ? (
        <QueryState pending={latest.isPending} error={latest.error} retry={latest.refetch} />
      ) : !run ? (
        <SimulationRequired />
      ) : (
        <>
          <BaselineNotice run={run} refreshing={latest.isFetching} refresh={latest.refetch} />
          <CatalogWorkspace key={baselineKey(run)} run={run} />
        </>
      )}
    </div>
  )
}

function CatalogWorkspace({ run }: { run: SimulationRun }) {
  const catalog = usePlannerCatalog(run)
  const graph = useGraph('operational')
  if (catalog.isPending || catalog.isError || graph.isPending || graph.isError)
    return (
      <QueryState
        pending={catalog.isPending || graph.isPending}
        error={catalog.error ?? graph.error}
        retry={() => {
          void catalog.refetch()
          void graph.refetch()
        }}
      />
    )
  if (
    !catalog.data ||
    !graph.data ||
    graph.data.type !== 'operational' ||
    graph.data.scenario_id !== run.scenario_id ||
    graph.data.snapshot_id !== run.snapshot_id
  )
    return (
      <p role="alert">Operational graph and simulation context do not match. Check the baseline.</p>
    )
  return (
    <Workspace
      key={catalog.data.catalog_fingerprint}
      run={run}
      catalog={catalog.data}
      graph={graph.data}
    />
  )
}

function Workspace({
  run,
  catalog,
  graph,
}: {
  run: SimulationRun
  catalog: Models['Catalog']
  graph: Models['OperationalGraph'] | Models['CyberGraph']
}) {
  const [params] = useSearchParams()
  const [asset, setAsset] = useState(params.get('asset') ?? '')
  const [cause, setCause] = useState<Models['Failure']['cause']>('power_loss')
  const [effect, setEffect] = useState<Models['Failure']['effect']>('unavailability')
  const [horizon, setHorizon] = useState('360')
  const [recovery, setRecovery] = useState('')
  const [candidateIds, setCandidateIds] = useState<string[]>([])
  const [budget, setBudget] = useState('12')
  const [effort, setEffort] = useState('24')
  const [downtime, setDowntime] = useState('6')
  const [windowLimit, setWindowLimit] = useState('')
  const [search, setSearch] = useState('')
  const [backup, setBackup] = useState('')
  const [disableBackup, setDisableBackup] = useState(false)
  const [energy, setEnergy] = useState('1')
  const [extra, setExtra] = useState('')
  const [view, setView] = useState<'before' | 'after' | 'stress'>('before')
  const [replaySerial, setReplaySerial] = useState(0)
  const simulate = usePlannerAction(api.resilienceSimulate)
  const optimize = usePlannerAction(api.resilienceOptimize)
  const protectedReplay = usePlannerAction(api.resilienceSimulate)
  const stress = usePlannerAction(api.resilienceStress)
  const names = useMemo(
    () =>
      new Map([
        ...graph.nodes.map((a) => [a.id, a.name] as const),
        ...run.services.map((s) => [s.service_id, s.name] as const),
      ]),
    [graph.nodes, run.services],
  )
  const known = graph.nodes.some((a) => a.id === asset)
  const validScenario =
    known &&
    !numericIssue(horizon, 1440, true) &&
    Number(horizon) >= 1 &&
    (!recovery || (!numericIssue(recovery, 10080, true) && Number(recovery) >= 1))
  const scenario: Models['FailureScenario'] = {
    horizon_minutes: Number(horizon),
    failures: [
      {
        id: 'planner-failure',
        asset_id: asset,
        cause,
        effect: cause === 'cyber' ? effect : 'unavailability',
        recovery_minutes: recovery ? Number(recovery) : null,
      },
    ],
    cyber_challenges: [],
  }
  const baseBody: Models['EvaluationRequest'] = {
    ...binding(run),
    baseline_fingerprint: run.fingerprint,
    catalog_fingerprint: catalog.catalog_fingerprint,
    scenario,
    intervention_ids: [],
  }
  const scenarioKey = JSON.stringify([baselineKey(run), catalog.catalog_fingerprint, scenario])
  const constraintsValid =
    !numericIssue(budget, 1000000, true) &&
    !numericIssue(effort, 1000000) &&
    !numericIssue(downtime, 1000000) &&
    (!windowLimit || !numericIssue(windowLimit, 1000000))
  const planKey = JSON.stringify([
    scenarioKey,
    [...candidateIds].sort(),
    budget,
    effort,
    downtime,
    windowLimit,
  ])
  const baseline =
    !simulate.isError && simulate.data?.inputKey === scenarioKey ? simulate.data.result : undefined
  const plan =
    baseline && !optimize.isError && optimize.data?.inputKey === planKey
      ? optimize.data.result
      : undefined
  const replay =
    plan && !protectedReplay.isError && protectedReplay.data?.inputKey === planKey
      ? protectedReplay.data.result
      : undefined
  const replayMismatch =
    !!replay && JSON.stringify(replay.comparison) !== JSON.stringify(plan?.comparison)
  const backups = catalog.interventions.filter((a) => a.action_type === 'backup_power')
  const stressCase: Models['StressCase'] = {
    id: 'planner-stress',
    failed_backup_ids: disableBackup && backup ? [backup] : [],
    backup_capacity:
      backup && Number(energy) < 1
        ? [{ backup_asset_id: backup, usable_energy_fraction: Number(energy) }]
        : [],
    additional_failures: extra
      ? [
          {
            id: 'planner-extra',
            asset_id: extra,
            cause: 'hardware_failure',
            effect: 'unavailability',
            recovery_minutes: null,
          },
        ]
      : [],
  }
  const stressKey = JSON.stringify([planKey, stressCase])
  const stressed =
    replay && !replayMismatch && !stress.isError && stress.data?.inputKey === stressKey
      ? stress.data.result
      : undefined
  const activeComparison =
    view === 'stress'
      ? stressed?.cases[0]?.comparison
      : view === 'after'
        ? !replayMismatch
          ? replay?.comparison
          : undefined
        : baseline?.comparison
  const outcome: Outcome | undefined =
    view === 'before' ? activeComparison?.before : activeComparison?.after
  const busy =
    simulate.isPending || optimize.isPending || protectedReplay.isPending || stress.isPending
  const chooseAsset = (id: string) => {
    setAsset(id)
    setCandidateIds(
      catalog.interventions
        .filter(
          (a) =>
            a.asset_id === id || (a.action_type === 'backup_power' && a.evidence_ids.includes(id)),
        )
        .map((a) => a.id)
        .slice(0, 12),
    )
    setView('before')
  }
  // Preselect eligible catalog actions for a linked asset without manufacturing effects.
  useEffect(() => {
    if (known && candidateIds.length === 0 && !optimize.data) chooseAsset(asset)
  }, []) // mount only
  const errors = [simulate.error, optimize.error, protectedReplay.error, stress.error].filter(
    (e): e is Error => !!e,
  )
  const avoidedAssets = replay
    ? replay.comparison.before.asset_outages.filter(
        (a) => !replay.comparison.after.asset_outages.some((b) => b.asset_id === a.asset_id),
      )
    : []
  const shorterAssets = replay
    ? replay.comparison.before.asset_outages.filter((a) => {
        const after = replay.comparison.after.asset_outages.find((b) => b.asset_id === a.asset_id)
        return after && minutesLost(after.intervals) < minutesLost(a.intervals)
      })
    : []
  return (
    <div className="planner-stack">
      <Panel title="1 / Select an asset and failure assumption">
        <div className="panel-padding planner-stack">
          <div className="planner-inputs">
            <label>
              Failure asset
              <select value={asset} onChange={(e) => chooseAsset(e.target.value)}>
                <option value="">Choose an asset…</option>
                {graph.nodes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Failure cause
              <select value={cause} onChange={(e) => setCause(e.target.value as typeof cause)}>
                <option value="power_loss">Local power loss</option>
                <option value="hardware_failure">Hardware failure</option>
                <option value="cyber">Already-assumed cyber compromise</option>
              </select>
            </label>
            {cause === 'cyber' && (
              <label>
                Assumed compromise effect
                <select value={effect} onChange={(e) => setEffect(e.target.value as typeof effect)}>
                  {[
                    'unavailability',
                    'loss_of_control',
                    'data_integrity',
                    'loss_of_visibility',
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Horizon (minutes)
              <input
                type="number"
                min="1"
                max="1440"
                step="1"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
              />
            </label>
            <label>
              Existing restoration deadline (minutes, optional)
              <input
                type="number"
                min="1"
                max="10080"
                step="1"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
              />
            </label>
          </div>
          <p className="small muted">
            All events start at minute zero. A blank restoration deadline assumes no repair during
            the horizon. Patches and segmentation cannot erase a direct, already-assumed failure;
            prepared recovery and eligible standby continuity may help.
          </p>
          {!validScenario && (
            <p role="status">Choose a known asset and valid integer minute limits.</p>
          )}
          <button
            className="button primary"
            disabled={!validScenario || busy}
            onClick={() => {
              setView('before')
              simulate.mutate({ run, inputKey: scenarioKey, body: baseBody })
            }}
          >
            Simulate failure
          </button>
          {simulate.data && !baseline && !simulate.isError && (
            <Outdated subject="Failure simulation" />
          )}
        </div>
      </Panel>
      {busy && <p role="status">Calculating against the exact run and catalog fingerprint…</p>}
      {errors.map((error, i) => (
        <ActionError key={i} error={error} />
      ))}
      <Panel title="2 / Set planning limits and candidate interventions">
        <div className="panel-padding planner-stack">
          <div className="planner-inputs">
            {[
              ['Budget (planning credits)', budget, setBudget],
              ['Effort limit (hours)', effort, setEffort],
              ['Total maintenance downtime (hours)', downtime, setDowntime],
              ['Per-action maintenance window (hours, optional)', windowLimit, setWindowLimit],
            ].map(([label, value, setter]) => (
              <label key={label as string}>
                {label as string}
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step={label === 'Budget (planning credits)' ? '1' : 'any'}
                  value={value as string}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                />
              </label>
            ))}
          </div>
          <p>
            Costs and restoration targets are synthetic planning assumptions. Maintenance downtime
            is pre-incident effort, separate from incident disruption. Exact search covers only the
            selected candidates (at most 12), not every possible real-world intervention.
          </p>
          <label>
            Find catalog interventions
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <p>
            {candidateIds.length} / 12 candidates selected. Select candidates from any asset to
            evaluate cross-sector protection.
          </p>
          <fieldset className="planner-candidates">
            <legend>Candidate interventions</legend>
            {catalog.interventions
              .filter((a) =>
                `${a.id} ${names.get(a.asset_id)} ${a.action_type}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((a) => (
                <label key={a.id}>
                  <input
                    type="checkbox"
                    checked={candidateIds.includes(a.id)}
                    disabled={!candidateIds.includes(a.id) && candidateIds.length >= 12}
                    onChange={(e) =>
                      setCandidateIds(
                        e.target.checked
                          ? [...candidateIds, a.id]
                          : candidateIds.filter((id) => id !== a.id),
                      )
                    }
                  />
                  {a.id} · {a.cost_credits} credits / {a.effort_hours}h effort / {a.downtime_hours}h
                  downtime
                </label>
              ))}
          </fieldset>
          {!constraintsValid && (
            <p role="alert">
              Use finite, nonnegative planning limits; budget credits must be an integer.
            </p>
          )}
          <button
            className="button primary"
            disabled={!baseline || !constraintsValid || !candidateIds.length || busy}
            onClick={() =>
              optimize.mutate({
                run,
                inputKey: planKey,
                body: {
                  ...baseBody,
                  intervention_ids: [...candidateIds].sort(),
                  budget_credits: Number(budget),
                  effort_limit_hours: Number(effort),
                  downtime_limit_hours: Number(downtime),
                  max_action_downtime_hours: windowLimit ? Number(windowLimit) : null,
                  excluded_asset_ids: [],
                  service_ids: [],
                },
              })
            }
          >
            Optimize protection
          </button>
          {optimize.data && !plan && !optimize.isError && <Outdated subject="Preventive plan" />}
          {plan && (
            <>
              <p role="status">
                {plan.interventions.length} selected actions · {plan.cost_credits} credits /{' '}
                {plan.effort_hours}h effort / {plan.downtime_hours}h downtime.{' '}
                {plan.feasible_subsets} feasible of {plan.subsets_considered} subsets.
              </p>
              {!plan.interventions.length && (
                <p>
                  No feasible beneficial intervention was selected under these limits. The empty
                  plan is valid; it does not establish safety.
                </p>
              )}
              <ul>
                {plan.interventions.map((a) => (
                  <li key={a.id}>
                    <strong>{a.id}</strong> — {a.modelled_effect}
                    <p>{a.preconditions.join(' ')}</p>
                    {a.patch && (
                      <p>
                        Reference-supported patch CVEs:{' '}
                        {a.patch.remediated
                          .map((c) => `${c.cve_id} (fixed in ${c.fixed_in ?? 'not documented'})`)
                          .join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <details>
                <summary>Rejected alternatives and standalone outcomes</summary>
                <ul>
                  {plan.rejected_alternatives.map((a) => (
                    <li key={a.intervention_id}>
                      {a.intervention_id}: {a.reasons.join(', ')} ·{' '}
                      {a.standalone_disruption_minutes} standalone service-minutes.
                    </li>
                  ))}
                </ul>
              </details>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  setView('after')
                  setReplaySerial((s) => s + 1)
                  protectedReplay.mutate({
                    run,
                    inputKey: planKey,
                    body: { ...baseBody, intervention_ids: plan.interventions.map((a) => a.id) },
                  })
                }}
              >
                Replay protected scenario
              </button>
            </>
          )}
        </div>
      </Panel>
      {replayMismatch && (
        <p role="alert">
          Replay differs from the optimized plan. Recalculate before comparing or stress testing.
        </p>
      )}
      <Panel title="3 / Compare the same scenario">
        <div className="panel-padding planner-stack">
          {baseline ? (
            <>
              <div className="workflow-comparison" aria-label="Modelled service-minute comparison">
                <div>
                  <span>Unprotected service-disruption minutes</span>
                  <strong>{baseline.comparison.before.total_service_disruption_minutes}</strong>
                </div>
                <div>
                  <span>Protected service-disruption minutes</span>
                  <strong>
                    {replay && !replayMismatch
                      ? replay.comparison.after.total_service_disruption_minutes
                      : 'Not replayed'}
                  </strong>
                </div>
              </div>
              {replay && !replayMismatch && (
                <>
                  <ServiceComparison comparison={replay.comparison} names={names} />
                  <p>
                    Improved services:{' '}
                    {replay.comparison.improved_service_ids
                      .map((id) => names.get(id) ?? id)
                      .join(', ') || 'none'}
                    . Fully protected services in this scenario:{' '}
                    {replay.comparison.fully_protected_service_ids
                      .map((id) => names.get(id) ?? id)
                      .join(', ') || 'none'}
                    .
                  </p>
                  <p>
                    Assets with no remaining outage:{' '}
                    {avoidedAssets.map((a) => a.asset_id).join(', ') || 'none'}. Shorter outage
                    intervals: {shorterAssets.map((a) => a.asset_id).join(', ') || 'none'}. These
                    summaries are derived from returned intervals.
                  </p>
                </>
              )}
              <div className="planner-controls" role="group" aria-label="Choose replay scenario">
                <button
                  className="button secondary"
                  aria-pressed={view === 'before'}
                  onClick={() => {
                    setView('before')
                    setReplaySerial((s) => s + 1)
                  }}
                >
                  Unprotected replay
                </button>
                <button
                  className="button secondary"
                  aria-pressed={view === 'after'}
                  disabled={!replay || replayMismatch}
                  onClick={() => {
                    setView('after')
                    setReplaySerial((s) => s + 1)
                  }}
                >
                  Protected replay
                </button>
                <button
                  className="button secondary"
                  aria-pressed={view === 'stress'}
                  disabled={!stressed}
                  onClick={() => {
                    setView('stress')
                    setReplaySerial((s) => s + 1)
                  }}
                >
                  Stressed replay
                </button>
              </div>
            </>
          ) : (
            <p>
              Simulate a failure to see actual backend outcomes. Missing results are not zero
              disruption.
            </p>
          )}
        </div>
      </Panel>
      {outcome && (
        <Replay
          key={`${view}:${scenarioKey}:${planKey}:${stressKey}:${replaySerial}`}
          outcome={outcome}
          nodes={graph.nodes}
          edges={graph.edges}
          names={names}
          label={view === 'before' ? 'Unprotected' : view === 'after' ? 'Protected' : 'Stressed'}
        />
      )}
      <Panel title="4 / Stress-test the protected scenario">
        <div className="panel-padding planner-stack">
          <label>
            Standby provider
            <select value={backup} onChange={(e) => setBackup(e.target.value)}>
              <option value="">Choose a standby…</option>
              {backups.map((a) => (
                <option key={a.id} value={a.asset_id}>
                  {a.asset_id} · {names.get(a.asset_id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={disableBackup}
              onChange={(e) => setDisableBackup(e.target.checked)}
              disabled={!backup}
            />{' '}
            Force selected backup unavailable for the whole horizon
          </label>
          <label>
            Usable backup energy fraction: {energy}
            <input
              aria-label="Usable backup energy fraction"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={energy}
              disabled={!backup}
              onChange={(e) => setEnergy(e.target.value)}
            />
          </label>
          <p className="small muted">
            Reduced energy shortens full-output runtime. It is not a fractional-load power-flow
            model.
          </p>
          <label>
            Additional hardware failure (optional)
            <select value={extra} onChange={(e) => setExtra(e.target.value)}>
              <option value="">None</option>
              {graph.nodes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={
              !replay ||
              replayMismatch ||
              busy ||
              !(extra || (backup && (disableBackup || Number(energy) < 1)))
            }
            onClick={() => {
              setView('stress')
              setReplaySerial((s) => s + 1)
              stress.mutate({
                run,
                inputKey: stressKey,
                body: {
                  ...baseBody,
                  intervention_ids: plan!.interventions.map((a) => a.id),
                  cases: [stressCase],
                },
              })
            }}
          >
            Calculate stress test
          </button>
          {stress.data && !stressed && !stress.isError && <Outdated subject="Stress comparison" />}
          {stressed && (
            <>
              <p role="status">
                Stressed protected disruption:{' '}
                <strong>
                  {stressed.cases[0].comparison.after.total_service_disruption_minutes}
                </strong>{' '}
                service-minutes. Extra versus nominal protected plan:{' '}
                {stressed.cases[0].extra_projected_disruption_minutes} minutes.
              </p>
              <ServiceComparison comparison={stressed.cases[0].comparison} names={names} />
              <p>
                This table compares stressed no-action versus stressed protected outcomes; the extra
                figure compares stressed protected versus nominal protected.
              </p>
            </>
          )}
        </div>
      </Panel>
      <details>
        <summary>Model assumptions, provenance and limitations</summary>
        <p>
          Catalog {catalog.catalog_version} · {catalog.catalog_fingerprint}. Baseline model{' '}
          {catalog.model_version} as of {catalog.baseline_as_of}.
        </p>
        <ul>
          {catalog.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        {replay && (
          <p>
            Engine {replay.engine_version} · calculated {replay.calculated_at} · input fingerprint{' '}
            {replay.input_fingerprint} · projected / {replay.verification}
          </p>
        )}
      </details>
    </div>
  )
}
