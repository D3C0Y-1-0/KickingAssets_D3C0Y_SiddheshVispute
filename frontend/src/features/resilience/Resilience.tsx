import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeading, Panel, QueryState, SampleBadge } from '../../components/ui'
import { useChokepoints, useServices, useVendors } from '../../hooks/queries'
import '../insights/insights.css'

type Tab = 'chokepoints' | 'vendors'
const effectName: Record<string, string> = {
  unavailability: 'Switched off',
  loss_of_control: 'Taken over',
  data_integrity: 'Data tampered',
  loss_of_visibility: 'Blind',
}

function Disruption({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="faint">Unavailable</span>
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

function Chokepoints() {
  const query = useChokepoints()
  const services = useServices()
  const [onlyChokepoints, setOnlyChokepoints] = useState(true)
  const names = useMemo(
    () => Object.fromEntries((services.data ?? []).map((s) => [s.id, s.name])),
    [services.data],
  )
  const data = query.data
  const rows = useMemo(
    () => (data?.chokepoints ?? []).filter((c) => !onlyChokepoints || c.is_chokepoint),
    [data, onlyChokepoints],
  )
  if (query.isPending || query.error) {
    return <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
  }
  const count = data?.chokepoints.filter((c) => c.is_chokepoint).length ?? 0
  return (
    <Panel
      title="Single points of failure"
      aside={
        <span className="subtle-label">
          {count} single points of failure among {data?.chokepoints.length} assets
        </span>
      }
    >
      <div className="ins-toolbar">
        <label className="muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={onlyChokepoints}
            onChange={(e) => setOnlyChokepoints(e.target.checked)}
          />
          Single points of failure only
        </label>
        <span className="grow" />
        <span className="subtle-label">
          Each asset removed alone, either switched off or taken over
        </span>
      </div>
      <div className="table-scroll">
        <table className="ins-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Asset</th>
              <th>Worst case</th>
              <th>Services that stop</th>
              <th>Worst service</th>
              <th className="num">Assets lost</th>
              <th className="num">Relied on by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.asset_id}>
                <td className="num">{i + 1}</td>
                <td>
                  <Link
                    className="text-link"
                    to={`/infrastructure?mode=operational&focus=${c.asset_id}`}
                  >
                    {c.asset_name}
                  </Link>
                  <span className="ins-sub mono">
                    {c.asset_id} · {c.sector} · {c.criticality}
                  </span>
                  <span className="ins-sub">{c.reason}</span>
                </td>
                <td>{c.worst ? effectName[c.worst.effect] : 'n/a'}</td>
                <td>
                  <span className="ins-tags">
                    {c.worst?.services_fully_disrupted.length ? (
                      c.worst.services_fully_disrupted.map((s) => (
                        <span className="ins-tag hot" key={s}>
                          {names[s] ?? s}
                        </span>
                      ))
                    ) : (
                      <span className="faint">None</span>
                    )}
                  </span>
                </td>
                <td>
                  <Disruption value={c.worst?.worst_disruption} />
                </td>
                <td className="num">{c.worst?.assets_lost ?? 0}</td>
                <td className="num">{c.direct_dependents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <EmptyState title="No chokepoints" compact>
          No single asset fully disrupts a service on its own.
        </EmptyState>
      )}
      <details className="ins-fine" style={{ padding: '0 16px 14px' }}>
        <summary>Assumptions</summary>
        <ul>
          {data?.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </Panel>
  )
}

function Vendors() {
  const query = useVendors()
  if (query.isPending || query.error) {
    return <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
  }
  const data = query.data
  return (
    <>
      <Panel
        title="If a vendor's update channel were compromised"
        aside={<SampleBadge>Assumed what-if</SampleBadge>}
      >
        <div className="table-scroll">
          <table className="ins-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th className="num">Assets</th>
                <th className="num">Essential</th>
                <th>Worst service disruption</th>
                <th className="num">Assets lost</th>
                <th
                  className="num"
                  title="Flaws on the CISA list of vulnerabilities attackers are already using, matched by vendor name"
                >
                  Attacked flaws: all / last 2 yrs
                </th>
                <th>Services touched</th>
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.vendor}>
                  <td>
                    <strong>{v.vendor}</strong>
                    <span className="ins-sub mono">{v.assets.join(', ')}</span>
                  </td>
                  <td className="num">{v.assets.length}</td>
                  <td className="num">{v.essential_assets}</td>
                  <td>
                    <Disruption value={v.worst_disruption} />
                  </td>
                  <td className="num">{v.assets_lost}</td>
                  <td className="num">
                    {v.kev_entries_total} / {v.kev_entries_last_24_months}
                  </td>
                  <td>
                    <span className="ins-tags">
                      {v.services
                        .filter((s) => s.vendor_assets > 0)
                        .map((s) => (
                          <span className="ins-tag" key={s.service_id}>
                            {s.service_name}: {s.vendor_assets}/{s.service_assets}
                          </span>
                        ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ins-note">
          Every asset of the vendor suffers its default effect for its type at the same moment,
          at once. Vendors are assumed products, not a scan.
          {data.kev_available ? '' : ' The attacked-flaws list was not available, so those counts show 0.'}
        </p>
      </Panel>
      <div className="ins-grid">
        <Panel title="Vendor concentration per service">
          <div className="table-scroll">
            <table className="ins-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Top vendor</th>
                  <th className="num">Share</th>
                  <th className="num" title="1.00 means one vendor supplies everything">
                    Dependence
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.concentration.map((c) => (
                  <tr key={c.service_id}>
                    <td>{c.service_name}</td>
                    <td>{c.top_vendor || 'n/a'}</td>
                    <td className="num">{Math.round(c.top_vendor_share * 100)}%</td>
                    <td className="num">{c.hhi.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="How to read this">
          <ul className="ins-events">
            {data.assumptions.map((line) => (
              <li key={line}>
                <span className="ins-sub" style={{ marginTop: 0 }}>
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}

export default function Resilience() {
  const [tab, setTab] = useState<Tab>('chokepoints')
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / WEAK POINTS"
        title="Weak points"
        description="Where one failure hurts most: single points of failure inside the city, and how far a hacked supplier would reach."
        actions={
          <div className="segmented-control" aria-label="Resilience view">
            <button
              className={tab === 'chokepoints' ? 'selected' : ''}
              aria-pressed={tab === 'chokepoints'}
              onClick={() => setTab('chokepoints')}
            >
              Single points
            </button>
            <button
              className={tab === 'vendors' ? 'selected' : ''}
              aria-pressed={tab === 'vendors'}
              onClick={() => setTab('vendors')}
            >
              Suppliers
            </button>
          </div>
        }
      />
      <div style={{ marginTop: 16 }}>{tab === 'chokepoints' ? <Chokepoints /> : <Vendors />}</div>
    </>
  )
}
