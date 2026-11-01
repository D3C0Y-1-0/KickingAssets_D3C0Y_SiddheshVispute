import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { EmptyState, PageHeading, Panel, QueryState, SampleBadge } from '../../components/ui'
import { useAssets, useActivity } from '../../hooks/queries'
import { useAttacker, usePrevention, useReaction, useRunReady } from '../../hooks/defense'
import '../insights/insights.css'
import './defense.css'

type Tab = 'attack' | 'prevent' | 'react'

const statusWords: Record<string, string> = {
  plausible: 'Likely',
  conditional: 'Possible',
  insufficient_evidence: 'Unknown',
}
const effectWords: Record<string, string> = {
  unavailability: 'switched off',
  loss_of_control: 'taken over',
  data_integrity: 'data tampered',
  loss_of_visibility: 'blinded',
}

function Loss({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="faint">Unknown</span>
  const cls = value >= 0.99 ? 'full' : value < 0.4 ? 'mild' : ''
  return (
    <span className="ins-bar">
      <span className="track">
        <i className={cls} style={{ width: `${value * 100}%` }} />
      </span>
      <span className="mono">{Math.round(value * 100)}%</span>
    </span>
  )
}

function NeedsRun() {
  return (
    <EmptyState title="Run the simulation first">
      This page uses the latest simulation. Open{' '}
      <Link className="text-link" to="/live">
        Live simulation
      </Link>{' '}
      and press Start, or use Run simulation on the Overview.
    </EmptyState>
  )
}

function AttackerTab() {
  const query = useAttacker()
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const routes = useMemo(() => query.data?.routes ?? [], [query.data])
  const route = routes[index]
  const last = (route?.frames.length ?? 1) - 1

  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), 1400)
    return () => window.clearTimeout(id)
  }, [playing, step, last])

  if (query.isPending || query.error) {
    return <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
  }
  if (!route) {
    return (
      <EmptyState title="No route found">
        No plausible route from an exposed entry point to a critical asset.
      </EmptyState>
    )
  }
  const frame = route.frames[Math.min(step, last)]
  const pick = (i: number) => {
    setIndex(i)
    setStep(0)
    setPlaying(false)
  }
  return (
    <div className="def-grid">
      <Panel title="The attacker’s easiest routes" aside={<SampleBadge>What-if</SampleBadge>}>
        <ul className="def-routes">
          {routes.map((r, i) => (
            <li key={`${r.entry_point}-${r.target}`}>
              <button
                className={i === index ? 'selected' : ''}
                aria-pressed={i === index}
                onClick={() => pick(i)}
              >
                <strong>
                  {r.entry_point} → {r.target}
                </strong>
                <span>{r.target_name}</span>
                <span className="ins-tag">{statusWords[r.status]}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="ins-note">
          One best route per critical asset. “Likely” means the evidence supports every step;
          “Possible” means some steps depend on an unproven weakness. None of these has happened.
        </p>
      </Panel>
      <Panel title={`Replay: ${route.entry_point} → ${route.target_name}`}>
        <div className="def-chain" aria-label="Route">
          {route.frames.map((f, i) => (
            <button
              key={f.asset_id}
              className={`def-node ${i === step ? 'now' : i < step ? 'done' : ''}`}
              onClick={() => {
                setStep(i)
                setPlaying(false)
              }}
            >
              <span className="num">{i + 1}</span>
              <span>{f.asset_name}</span>
            </button>
          ))}
        </div>
        <div className="def-controls">
          <button
            className="button secondary"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label="Previous step"
          >
            <SkipBack size={15} />
          </button>
          <button
            className="button primary"
            onClick={() => {
              if (step >= last) setStep(0)
              setPlaying((p) => !p)
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? 'Pause' : step >= last ? 'Replay' : 'Play'}
          </button>
          <button
            className="button secondary"
            onClick={() => setStep((s) => Math.min(last, s + 1))}
            disabled={step >= last}
            aria-label="Next step"
          >
            <SkipForward size={15} />
          </button>
          <span className="subtle-label">
            Step {step + 1} of {last + 1}
          </span>
        </div>
        <div className="def-now">
          <strong>
            {frame.asset_name} is {effectWords[frame.effect] ?? frame.effect}
          </strong>
          <p>{frame.note}</p>
        </div>
        <div className="def-services">
          <div className="subtle-label">Services right now</div>
          {frame.services.map((s) => (
            <div className="def-service" key={s.service_id}>
              <span>{s.service_name}</span>
              <Loss value={s.fraction} />
            </div>
          ))}
        </div>
        <p className="ins-note">
          A bar shows how much of a service stops, at worst, with backups applied and no operator
          recovery. It is a simulated story, not a prediction.
        </p>
      </Panel>
    </div>
  )
}

function PreventionTab() {
  const query = usePrevention()
  if (query.isPending || query.error) {
    return <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
  }
  const plan = query.data
  if (plan.status === 'nothing_to_cut') {
    return (
      <EmptyState title="Nothing to cut">
        No plausible route reaches a critical asset, so no segmentation is needed.
      </EmptyState>
    )
  }
  if (plan.status === 'cannot_cut') {
    return (
      <EmptyState title="No cut found">
        An entry point is also a critical asset, so segmentation alone cannot block it.
      </EmptyState>
    )
  }
  return (
    <>
      <div className="ins-metrics">
        <div className="ins-metric">
          <div className="label">Assets to isolate</div>
          <div className="value">{plan.assets.length}</div>
          <div className="foot">the smallest set that works</div>
        </div>
        <div className="ins-metric">
          <div className="label">Effort</div>
          <div className="value">{plan.total_hours} h</div>
          <div className="foot">instead of {plan.isolate_everything_hours} h for everything</div>
        </div>
        <div className="ins-metric">
          <div className="label">Routes</div>
          <div className="value">
            {plan.routes_before} → {plan.routes_after}
          </div>
          <div className="foot">plausible routes before and after</div>
        </div>
        <div className="ins-metric">
          <div className="label">Critical assets safe</div>
          <div className="value">
            {plan.protected_targets.length} / {plan.targets_before}
          </div>
          <div className="foot">no route left to reach them</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Panel
          title="Cut these connections first"
          aside={<SampleBadge>Estimate, not applied</SampleBadge>}
        >
          <div className="table-scroll">
            <table className="ins-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Role on the routes</th>
                  <th className="num">Routes through it</th>
                  <th className="num">Effort</th>
                </tr>
              </thead>
              <tbody>
                {plan.assets.map((a) => (
                  <tr key={a.asset_id}>
                    <td>
                      <strong>{a.name}</strong>
                      <span className="ins-sub mono">
                        {a.asset_id} · {a.sector} · {a.criticality}
                      </span>
                    </td>
                    <td>
                      {a.role === 'pivot'
                        ? 'Stepping stone'
                        : a.role === 'entry'
                          ? 'Entry point'
                          : 'Critical asset'}
                    </td>
                    <td className="num">{a.routes_through}</td>
                    <td className="num">{a.cost_hours} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ins-note">
            This is the cheapest set of assets that, once cut off from the network, leaves no
            plausible route to any critical asset. We checked it by running the route finder again
            with these assets isolated. Isolating them may interrupt remote access and data flows,
            so test first. Try single changes in{' '}
            <Link className="text-link" to="/what-if">
              What-If
            </Link>
            .
          </p>
          <details className="ins-fine" style={{ padding: '0 16px 14px' }}>
            <summary>Assumptions</summary>
            <ul>
              {plan.assumptions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </Panel>
      </div>
    </>
  )
}

function ReactionTab() {
  const assets = useAssets()
  const activity = useActivity()
  const [chosen, setChosen] = useState<string | null>(null)
  const flagged = activity.data?.assets.find((a) => a.anomaly > 0)?.asset_id
  const asset = chosen ?? flagged ?? assets.data?.[0]?.id ?? null
  const query = useReaction(asset)
  const options = assets.data ?? []
  const plan = query.data
  return (
    <>
      <div className="def-pick">
        <label>
          <span className="subtle-label">If this asset were taken over</span>
          <select value={asset ?? ''} onChange={(e) => setChosen(e.target.value)}>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.name}
                {a.id === flagged ? ' (looks unusual now)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(query.isPending || query.error) && (
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
      )}
      {plan && (
        <div className="def-grid">
          <Panel title="What to do, in order" aside={<SampleBadge>Recommendations</SampleBadge>}>
            <ol className="def-steps">
              {plan.steps.map((s) => (
                <li key={s.order} className={s.kind}>
                  <span className="num">{s.order}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.detail}</p>
                    {s.hours !== null && s.hours !== undefined && (
                      <span className="ins-tag">{s.hours} h of segmentation work</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="ins-note">
              {plan.targets_reached.length === 0
                ? 'From here no critical asset is reachable on a plausible route.'
                : `Without blocking, ${plan.targets_reached.length} critical assets could be reached. After the block step, ${plan.targets_after_block} could.`}{' '}
              Nothing is applied automatically; a person must approve each step.
            </p>
          </Panel>
          <Panel title="Where it could spread next">
            {plan.spread.length === 0 ? (
              <EmptyState title="Nowhere" compact>
                No plausible onward route from this asset.
              </EmptyState>
            ) : (
              <ul className="def-spread">
                {plan.spread.map((r) => (
                  <li key={r.asset_id}>
                    <span className="wave">Hop {r.depth}</span>
                    <span>
                      <strong>{r.name}</strong>
                      <span className="ins-sub">{r.explanation}</span>
                    </span>
                    <span className="ins-tag">{statusWords[r.hop_status]}</span>
                    <Loss value={r.worst_disruption} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}

export default function Defense() {
  const [tab, setTab] = useState<Tab>('attack')
  const { ready, run } = useRunReady()
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / ATTACK & DEFEND"
        title="Attack and defend"
        description="See how an attacker could get in, the cheapest way to stop them, and what to do if one asset is taken over."
        actions={
          <div className="segmented-control" aria-label="View">
            {(
              [
                ['attack', 'Attacker’s view'],
                ['prevent', 'Prevent'],
                ['react', 'React'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'selected' : ''}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div style={{ marginTop: 16 }}>
        {run.isPending ? (
          <QueryState pending error={null} retry={run.refetch} />
        ) : !ready ? (
          <NeedsRun />
        ) : tab === 'attack' ? (
          <AttackerTab />
        ) : tab === 'prevent' ? (
          <PreventionTab />
        ) : (
          <ReactionTab />
        )}
      </div>
    </>
  )
}
