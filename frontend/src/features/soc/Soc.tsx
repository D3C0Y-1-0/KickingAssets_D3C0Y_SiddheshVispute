import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, ApiError, type Models } from '../../api/client'
import { PageHeading, Panel } from '../../components/ui'
import { useSoc } from './provider'
import { actionable, severityOf } from './evidence'
import IncidentAnalysis from './IncidentAnalysis'
import './soc.css'

export default function Soc() {
  const { snapshot, events, connection, assessEvent } = useSoc()
  const location = useLocation()
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('Operator reviewed suspicious activity')
  const [minutes, setMinutes] = useState('10')
  const [selected, setSelected] = useState<Models['SocEvent'] | null>(null)
  const [notice, setNotice] = useState('')
  const [archive, setArchive] = useState<Models['SocEvent'][]>([])
  const [historyMode, setHistoryMode] = useState(false)
  const blockForm = useRef<HTMLDivElement>(null)
  const ipInput = useRef<HTMLInputElement>(null)
  function chooseIP(address: string) {
    setIp(address)
    window.requestAnimationFrame(() => {
      ipInput.current?.focus({ preventScroll: true })
      blockForm.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
    })
  }
  const [clock, setClock] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  async function action(work: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await work()
      await snapshot.refetch()
      setNotice(typeof result === 'string' ? result : message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SOC operation failed')
    } finally {
      setBusy(false)
    }
  }
  const unauthorized = snapshot.error instanceof ApiError && snapshot.error.status === 401
  const suspect = events.filter((e) => e.severity !== 'info')
  const sources = new Set(events.map((e) => e.source_ip))
  const requests10s = events.filter(
    (e) => e.path && Date.parse(e.timestamp) >= clock - 10000,
  ).length
  const visible = [...(historyMode ? archive : events)]
    .sort((a, b) => b.id - a.id)
    .filter((e) =>
      `${e.source_ip} ${e.asset_id ?? ''} ${e.category} ${e.outcome} ${e.path} ${severityOf(e)}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
  const nodes = snapshot.data?.nodes ?? []
  const blocks = (snapshot.data?.blocks ?? []).filter((b) => b.expires_at * 1000 > clock)
  useEffect(() => {
    if (location.hash && snapshot.data) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    }
  }, [location.hash, !!snapshot.data])
  return (
    <div className="soc-page">
      <PageHeading
        eyebrow="GRIDINAL / SECURITY OPERATIONS"
        title="SOC Overview"
        description="Actual HTTP evidence from this website and its confined node services. Infrastructure consequences remain separately modelled."
        actions={
          <div className="soc-controls">
            <span className="badge" role="status">
              {connection}
            </span>
            <button
              className="button secondary"
              disabled={busy || snapshot.isFetching}
              onClick={() => void snapshot.refetch()}
            >
              Resync evidence
            </button>
          </div>
        }
      />
      <nav className="workflow-nav" aria-label="Security operations">
        <a href="#soc-logs">Live logs</a>
        <a href="#soc-incidents">Incidents</a>
        <a href="#soc-nodes">Node services</a>
        <Link to="/overview">Infrastructure overview</Link>
      </nav>
      {!snapshot.data || snapshot.isError ? (
        <Panel title="Operator access">
          <div className="panel-padding soc-stack">
            <p>
              The console uses an eight-hour, HttpOnly operator session bound to this computer's
              connection address. Open this page through 127.0.0.1 on the server laptop. Remote
              devices cannot open operator sessions.
            </p>
            {snapshot.isPending ? (
              <p role="status">Connecting to the security store…</p>
            ) : (
              <>
                <p>
                  {unauthorized
                    ? 'Open the local operator session to inspect evidence and manage blocks.'
                    : snapshot.error?.message}
                </p>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void action(api.socSession, 'Operator session opened')}
                >
                  Open local operator session
                </button>
                <button className="button secondary" onClick={() => void snapshot.refetch()}>
                  Retry connection
                </button>
              </>
            )}
          </div>
        </Panel>
      ) : (
        <>
          <p className="callout">
            Node gateway: <strong>{snapshot.data.gateway_ready ? 'Online' : 'Not ready'}</strong> ·
            port {snapshot.data.gateway_port ?? 8006}. Use the server laptop's private IPv4 address
            from the second laptop. Start both processes with scripts/start-soc.ps1. Target profiles
            and IP rules persist; review them before testing.
          </p>
          <div className="soc-metrics" aria-label="Recent security window">
            {[
              ['Observed events', events.length],
              ['Rule alerts', suspect.length],
              ['Source addresses', sources.size],
              ['HTTP events / last 10s', requests10s],
              ['HTTP denials / errors', events.filter((e) => e.status >= 400).length],
              ['Active IP blocks', blocks.filter((b) => b.expires_at * 1000 > Date.now()).length],
            ].map(([label, value]) => (
              <div className="panel soc-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="small muted">
            Counters describe the most recent {events.length} loaded events (maximum 500), not
            all-time totals. The store retains approximately 10,000 events. IP addresses identify
            connections, not people. Reconnecting is shown explicitly; observations never turn into
            invented risk scores.
          </p>
          <IncidentAnalysis />
          <div id="soc-nodes">
            <Panel title="Live node evidence and protection">
              <div className="panel-padding soc-node-grid">
                {nodes.map((n) => {
                  const last = [...events].reverse().find((e) => e.asset_id === n.asset_id)
                  return (
                    <div className="soc-node" key={n.asset_id}>
                      <span className="mono">{n.asset_id}</span>
                      <h3>{n.name}</h3>
                      <p>{n.scenario}</p>
                      <span className={`badge ${n.protected ? 'implemented' : 'sample'}`}>
                        {n.protected ? 'Protected' : 'Vulnerable target profile'}
                      </span>
                      <p className="small">
                        {last
                          ? `${last.category} · ${last.outcome} · ${last.source_ip}`
                          : 'No observed target request in the loaded window.'}
                      </p>
                      <code>{n.path}</code>
                      <p className="small muted">
                        Reach this path on the separate node gateway port, not the SOC API.
                        Fictional records; no host-shell or physical equipment access.
                      </p>
                      <div className="soc-controls">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              () => api.socProtection(n.asset_id, !n.protected),
                              `${n.asset_id} protection ${n.protected ? 'disabled for confined demonstration' : 'enabled'}`,
                            )
                          }
                        >
                          {n.protected ? 'Enable vulnerable profile' : 'Enable protection'}
                        </button>
                        <Link className="text-link" to={`/resilience-planner?asset=${n.asset_id}`}>
                          Model conditional impact
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>
          <div id="soc-incidents">
            <Panel title="Explainable rule alerts">
              <div className="panel-padding soc-stack">
                <p>
                  Rules flag measured failures, policy violations or traffic bursts. An alert is not
                  proof of a malicious person or real infrastructure compromise.
                </p>
                {!suspect.length ? (
                  <p>No rule alerts observed in the loaded window.</p>
                ) : (
                  <ul className="soc-alerts">
                    {[...suspect]
                      .reverse()
                      .slice(0, 20)
                      .map((e) => (
                        <li key={e.id} className={`soc-severity-${severityOf(e)}`}>
                          <strong>
                            {severityOf(e).toUpperCase()} · {e.category}
                          </strong>
                          <span>
                            {e.asset_id ?? 'Website'} · {e.source_ip} · {e.outcome}
                          </span>
                          <p>{e.explanation}</p>
                          <div className="soc-controls">
                            <button className="button secondary" onClick={() => setSelected(e)}>
                              Inspect event #{e.id}
                            </button>
                            <button
                              className="button secondary"
                              onClick={() => {
                                chooseIP(e.source_ip)
                                setSelected(e)
                                setNotice(
                                  'Review IP, reason and duration in the blocking controls below.',
                                )
                              }}
                            >
                              Select IP for block
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </Panel>
          </div>
          <div id="soc-logs">
            <Panel title="Live security logs">
              <div className="panel-padding soc-stack">
                <label>
                  Filter source, asset or event
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="PWR-008, an IP address, blocked…"
                  />
                </label>
                {historyMode && (
                  <p>
                    Viewing an earlier retained page. The live stream and counters continue
                    updating.{' '}
                    <button className="text-link" onClick={() => setHistoryMode(false)}>
                      Return to live logs
                    </button>
                  </p>
                )}
                <div className="table-scroll">
                  <table>
                    <caption>Actual server events · newest first · updates without refresh</caption>
                    <thead>
                      <tr>
                        <th>UTC time</th>
                        <th>Source IP / asset</th>
                        <th>Event / outcome</th>
                        <th>Severity</th>
                        <th>HTTP</th>
                        <th>Headers latency</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(0, 500).map((e) => (
                        <tr key={e.id} className={`soc-log-row soc-severity-${severityOf(e)}`}>
                          <td>{e.timestamp}</td>
                          <td>
                            {e.source_ip}
                            <br />
                            {e.asset_id ?? 'Website'}
                          </td>
                          <td>
                            {e.category}
                            <br />
                            {e.outcome}
                          </td>
                          <td>
                            <span className="soc-severity-label">
                              {severityOf(e).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {e.method} {e.status}
                          </td>
                          <td>{e.latency_ms} ms</td>
                          <td>
                            <button className="text-link" onClick={() => setSelected(e)}>
                              Event #{e.id}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!visible.length && <p>No matching events. No sample activity is substituted.</p>}
                {events.length > 0 && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const before = Math.min(
                          ...(historyMode && archive.length ? archive : events).map((e) => e.id),
                        )
                        const rows = await api.socHistory(before)
                        setArchive(rows)
                        setHistoryMode(true)
                        return rows.length
                          ? `Showing ${rows.length} earlier retained events; live counters continue.`
                          : 'No earlier retained events remain. Return to live logs.'
                      }, 'Earlier retained events loaded')
                    }
                  >
                    Load earlier retained events
                  </button>
                )}
                <p className="small muted">
                  Request paths exclude query strings and bodies. Passwords, tokens and headers are
                  not collected. Durations measure server time to response headers, not complete
                  download time.
                </p>
              </div>
            </Panel>
          </div>
          {selected && (
            <Panel title={`Evidence #${selected.id}`}>
              <div className="panel-padding soc-stack">
                <p>{selected.explanation}</p>
                <dl className="detail-grid">
                  <dt>UTC</dt>
                  <dd>{selected.timestamp}</dd>
                  <dt>Peer address</dt>
                  <dd>{selected.source_ip}</dd>
                  <dt>Path</dt>
                  <dd>{selected.path}</dd>
                  <dt>Outcome</dt>
                  <dd>{selected.outcome}</dd>
                  <dt>Rule</dt>
                  <dd>{selected.rule_version ?? 'soc-rules-v1'}</dd>
                </dl>
                <p>Observed evidence is distinct from projected service disruption.</p>
                <div className="soc-controls">
                  {actionable(selected) && (
                    <button className="button secondary" onClick={() => assessEvent(selected)}>
                      Assess this event with the model
                    </button>
                  )}
                  <button className="button secondary" onClick={() => chooseIP(selected.source_ip)}>
                    Use source in blocking controls
                  </button>
                  {selected.asset_id && (
                    <Link
                      className="button secondary"
                      to={`/resilience-planner?asset=${selected.asset_id}`}
                    >
                      Open Resilience Planner
                    </Link>
                  )}
                  <button className="button secondary" onClick={() => setSelected(null)}>
                    Close evidence
                  </button>
                </div>
              </div>
            </Panel>
          )}
          <Panel title="IP blocking and audit">
            <div className="panel-padding soc-stack">
              <p>
                Rules deny new HTTP requests to both project gateways. Existing downloads are not
                terminated. This is application-layer enforcement, not a host firewall or
                SSH-session killer. Loopback and active operator addresses are protected from
                lockout. Never trust a forwarded-IP header from an untrusted client.
              </p>
              <div className="soc-block-form" ref={blockForm}>
                <label>
                  Client IP
                  <input
                    ref={ipInput}
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="Second laptop's connection IP"
                  />
                </label>
                <label>
                  Reason
                  <input
                    value={reason}
                    maxLength={160}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label>
                  Block duration (minutes)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !ip ||
                  reason.trim().length < 3 ||
                  !Number.isInteger(Number(minutes)) ||
                  Number(minutes) < 1 ||
                  Number(minutes) > 1440
                }
                onClick={() =>
                  void action(
                    () => api.socBlock({ ip, reason, minutes: Number(minutes) }),
                    'IP rule applied to both gateways',
                  )
                }
              >
                Block IP
              </button>
              {!blocks.length ? (
                <p>No active IP rules.</p>
              ) : (
                <ul>
                  {blocks.map((b) => (
                    <li key={b.ip}>
                      <strong>{b.ip}</strong> · {b.reason} · expires{' '}
                      {new Date(b.expires_at * 1000).toLocaleString()}{' '}
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => void action(() => api.socUnblock(b.ip), 'IP unblocked')}
                      >
                        Unblock {b.ip}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void action(api.socLogout, 'Operator session closed')}
              >
                Close operator session
              </button>
            </div>
          </Panel>
        </>
      )}
      {error && (
        <div className="run-error" role="alert">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  )
}
