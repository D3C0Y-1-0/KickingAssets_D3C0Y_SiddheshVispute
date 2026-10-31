import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Network, RotateCw } from 'lucide-react'
import { useAssets, useIntelligence, useServices, useSnapshots } from '../../hooks/queries'
import { AssetDrawer } from '../../components/AssetDrawer'
import {
  PageHeading,
  Panel,
  QueryState,
  RiskBadge,
  SectorBadge,
  sectorName,
} from '../../components/ui'
import type { Sector } from '../../api/client'
import Station from '../../components/illustration/Station'

export default function Overview() {
  const assets = useAssets()
  const services = useServices()
  const snapshots = useSnapshots()
  const intelligence = useIntelligence()
  const client = useQueryClient()
  const [sector, setSector] = useState<Sector>('power')
  const [selected, setSelected] = useState<string | null>(null)
  const report = intelligence.isError ? undefined : intelligence.data
  const priority = report?.assets.filter((a) => a.risk.status === 'computed') ?? []
  const distribution = ['critical', 'high', 'medium', 'low', 'unavailable'].map((name) => ({
    name,
    value: report?.assets.filter((a) => (a.risk.category ?? 'unavailable') === name).length ?? 0,
  }))
  if (assets.isPending || assets.isError)
    return <QueryState pending={assets.isPending} error={assets.error} retry={assets.refetch} />
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / COMMAND CENTER"
        title="Command overview"
        description="Evidence-backed review priorities across simulated critical infrastructure."
        actions={
          <>
            <button className="button secondary" onClick={() => void client.invalidateQueries()}>
              <RotateCw size={14} />
              Refresh evidence
            </button>
            <Link to="/infrastructure" className="button primary">
              <Network size={16} />
              Explore infrastructure
            </Link>
          </>
        }
      />
      <QueryState
        pending={intelligence.isPending}
        error={intelligence.error}
        retry={intelligence.refetch}
      />
      <div className="metric-grid">
        <section className="metric-card city-risk">
          <div className="metric-label">Covered-asset mean priority</div>
          <div className="metric-value">
            {report?.covered_asset_mean?.toFixed(1) ?? '—'}
            <span>/100</span>
          </div>
          <div className="metric-foot">
            {report?.assessed_count ?? '—'} / {assets.data.length} assessed · partial coverage
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">Infrastructure assets</div>
          <div className="metric-value">
            {assets.data.length}
            <span className="metric-unit">assets</span>
          </div>
          <div className="metric-foot">
            {new Set(assets.data.map((a) => a.sector)).size} simulated sectors
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">High / critical review priorities</div>
          <div className="metric-value">
            {report
              ? priority.filter((a) => ['high', 'critical'].includes(a.risk.category!)).length
              : '—'}
          </div>
          <div className="metric-foot">Calculated priorities within curated CVE coverage</div>
        </section>
        <section className="metric-card">
          <div className="metric-label">Unavailable priorities</div>
          <div className="metric-value">{report?.unavailable_count ?? '—'}</div>
          <div className="metric-foot">Missing evidence is not a zero score</div>
        </section>
      </div>
      <div className="risk-coverage">
        Relative review index, not a city-wide risk estimate or compromise probability. Real
        reference data and an experimental ML signal are applied to simulated infrastructure.{' '}
        <Link to="/intelligence">Inspect the formula, sources and evaluation →</Link>
      </div>
      <div className="overview-middle">
        <Panel
          title="Infrastructure at a glance"
          className="infrastructure-panel"
          aside={<span className="subtle-label mono">AURORA / BASELINE V1</span>}
        >
          <div className="infrastructure-body">
            <div className="infrastructure-copy">
              <div className="eyebrow">ONE CITY. THREE ESSENTIAL SYSTEMS.</div>
              <h3>
                Understand the connections.
                <br />
                <span>Before they become consequences.</span>
              </h3>
              <p>
                Explore the assets, independent graphs and conditional service consequences behind
                Aurora City.
              </p>
              <div className="sector-tabs" aria-label="Illustration sector focus">
                {(['power', 'water', 'healthcare'] as const).map((s) => (
                  <button
                    key={s}
                    aria-pressed={sector === s}
                    className={sector === s ? 'selected' : ''}
                    onClick={() => setSector(s)}
                  >
                    {sectorName[s]}
                  </button>
                ))}
              </div>
              <Link className="text-link" to={`/infrastructure?sector=${sector}`}>
                Open infrastructure map →
              </Link>
            </div>
            <Station sector={sector} />
          </div>
          <div className="infrastructure-bottom">
            <span>
              {assets.data.filter((a) => a.sector === sector).length} {sectorName[sector]} assets
            </span>
            <span>Illustration · no telemetry</span>
          </div>
        </Panel>
        <Panel title="Calculated priority distribution" className="distribution-panel">
          {report && (
            <>
              <div className="risk-donut">
                <ResponsiveContainer width="100%" height={154}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      innerRadius={54}
                      outerRadius={67}
                      paddingAngle={3}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {distribution.map((d) => (
                        <Cell
                          key={d.name}
                          fill={
                            d.name === 'unavailable'
                              ? 'var(--text-secondary)'
                              : `var(--risk-${d.name})`
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} assets`, 'Calculated coverage']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{report.assessed_count}</strong>
                  <small>ASSESSED</small>
                </div>
              </div>
              <div className="distribution-legend">
                {distribution.map((d) => (
                  <div key={d.name}>
                    <span>{d.name}</span>
                    <strong className="mono">{d.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="panel-footnote">
            Unavailable assets are explicitly counted. No preview scores are used.
          </p>
        </Panel>
      </div>
      <div className="overview-bottom">
        <Panel
          title="Calculated priority assets"
          aside={
            <Link to="/intelligence" className="text-link">
              Explain priorities →
            </Link>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ASSET</th>
                  <th>SECTOR</th>
                  <th>RELATIVE INDEX</th>
                  <th>CATEGORY</th>
                </tr>
              </thead>
              <tbody>
                {priority.slice(0, 5).map((a) => (
                  <tr key={a.asset_id}>
                    <td>
                      <button className="asset-name" onClick={() => setSelected(a.asset_id)}>
                        {a.name}
                      </button>
                      <small className="mono muted">{a.asset_id}</small>
                    </td>
                    <td>
                      <SectorBadge sector={a.sector as Sector} />
                    </td>
                    <td className="mono">{a.risk.score?.toFixed(2)}</td>
                    <td>
                      <RiskBadge category={a.risk.category ?? undefined} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-footnote">
            Versioned formula and model outputs; curated coverage is partial. Priority order does
            not predict incident timing.
          </p>
        </Panel>
        <Panel
          title="Essential services"
          aside={
            <Link to="/infrastructure?mode=operational" className="text-link">
              Dependencies →
            </Link>
          }
        >
          <QueryState
            pending={services.isPending}
            error={services.error}
            retry={services.refetch}
          />
          <div className="services-list">
            {services.data?.map((s) => (
              <Link
                className="service-item"
                key={s.id}
                to={`/infrastructure?mode=operational&sector=${s.sector}`}
              >
                <div>
                  <strong>{s.name}</strong>
                  <small>{s.requirements.length} requirement groups · simulated definition</small>
                </div>
              </Link>
            ))}
          </div>
          <p className="panel-footnote">
            Service disruption is calculated only under explicit assumed asset unavailability.
            Services are not monitored.
          </p>
        </Panel>
      </div>
      <Panel title="Inventory & assessment context">
        <QueryState
          pending={snapshots.isPending}
          error={snapshots.error}
          retry={snapshots.refetch}
        />
        {snapshots.data?.map((s) => (
          <p key={s.snapshot_id}>
            <span className="mono">{s.snapshot_id}</span> · Inventory captured{' '}
            {new Date(s.created_at).toLocaleDateString()} · {s.state}
          </p>
        ))}
        <p>
          Priority assessment:{' '}
          {report ? new Date(report.calculated_at).toLocaleString() : 'Unavailable'}. One inventory
          snapshot; no risk trend is claimed.
        </p>
      </Panel>
      <AssetDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  )
}
