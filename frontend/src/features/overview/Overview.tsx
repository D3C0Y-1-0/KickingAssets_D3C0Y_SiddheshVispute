import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Database,
  Droplets,
  HeartPulse,
  Network,
  RotateCw,
  ShieldAlert,
  Waypoints,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAssets, useServices, useSnapshots } from '../../hooks/queries'
import { AssetDrawer } from '../../components/AssetDrawer'
import {
  EmptyState,
  PageHeading,
  Panel,
  PreviewNotice,
  QueryState,
  RiskBadge,
  SampleBadge,
  SectorBadge,
  sectorName,
  TextLink,
} from '../../components/ui'
import { demoFor, demoRisk, categoryLabels } from '../../fixtures/previews'
import type { Sector } from '../../api/client'
import Station from '../../components/illustration/Station'

const sectorIcons = { power: Zap, water: Droplets, healthcare: HeartPulse }

export default function Overview() {
  const assets = useAssets()
  const services = useServices()
  const snapshots = useSnapshots()
  const client = useQueryClient()
  const [sector, setSector] = useState<Sector>('power')
  const [selected, setSelected] = useState<string | null>(null)
  if (assets.isPending || assets.isError)
    return <QueryState pending={assets.isPending} error={assets.error} retry={assets.refetch} />
  const rows = assets.data
  const priority = rows
    .filter((a) => demoFor(a.id))
    .sort((a, b) => demoFor(b.id)!.score - demoFor(a.id)!.score)
  const distribution = categoryLabels.map((name) => ({
    name,
    value: priority.filter((a) => demoFor(a.id)?.category === name).length,
  }))
  const sectorCount = new Set(rows.map((a) => a.sector)).size
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / COMMAND CENTER"
        title="Command overview"
        description="A connected view of critical infrastructure. A clearer path to resilience."
        actions={
          <>
            <button className="button secondary" onClick={() => void client.invalidateQueries()}>
              <RotateCw size={14} />
              Refresh inventory
            </button>
            <Link to="/infrastructure" className="button primary">
              <Network size={16} />
              Explore infrastructure
              <ArrowUpRight size={14} />
            </Link>
          </>
        }
      />
      <div className="metric-grid">
        <section className="metric-card city-risk">
          <div className="metric-label">
            City Risk Index
            <ShieldAlert size={16} />
          </div>
          <div className="metric-value">
            {demoRisk.cityIndex}
            <span>/ 100</span>
            <span className="risk-badge high">Elevated</span>
          </div>
          <div className="risk-scale">
            <i />
          </div>
          <div className="metric-foot">
            <span className="tiny-demo">DEMO PREVIEW</span>
            <span>Relative index · not incident probability</span>
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Infrastructure assets
            <Database size={16} />
          </div>
          <div className="metric-value">
            {rows.length.toString().padStart(2, '0')}
            <span className="metric-unit">assets</span>
          </div>
          <div className="metric-foot">
            <span className="mint-dot" />
            Loaded from scenario inventory
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Connected sectors
            <Waypoints size={16} />
          </div>
          <div className="metric-value">
            {sectorCount.toString().padStart(2, '0')}
            <div className="sector-mini-icons">
              <Zap size={14} />
              <Droplets size={14} />
              <HeartPulse size={14} />
            </div>
          </div>
          <div className="metric-foot">Power, water & healthcare</div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Essential services
            <HeartPulse size={16} />
          </div>
          <div className="metric-value">
            {services.data?.length.toString().padStart(2, '0') ?? '—'}
            <span className="metric-unit">defined</span>
          </div>
          <div className="metric-foot">
            {services.isError ? 'Service API unavailable' : 'Service status not assessed'}
          </div>
        </section>
      </div>
      <div className="overview-middle">
        <Panel
          title={
            <>
              <span className="panel-dot" />
              Infrastructure at a glance
            </>
          }
          aside={<span className="subtle-label mono">AURORA / BASELINE V1</span>}
          className="infrastructure-panel"
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
                Explore the assets behind Aurora City’s essential services, and the relationships
                that connect them.
              </p>
              <div className="sector-tabs" aria-label="Illustration sector focus">
                {(['power', 'water', 'healthcare'] as const).map((s) => {
                  const Icon = sectorIcons[s]
                  return (
                    <button
                      key={s}
                      aria-pressed={sector === s}
                      className={sector === s ? 'selected' : ''}
                      onClick={() => setSector(s)}
                    >
                      <Icon size={15} />
                      {sectorName[s]}
                    </button>
                  )
                })}
              </div>
              <Link to={`/infrastructure?sector=${sector}`} className="text-link">
                Open infrastructure map
                <ArrowRight size={15} />
              </Link>
            </div>
            <Station sector={sector} />
          </div>
          <div className="infrastructure-bottom">
            <span>
              <span className="status-dot" />
              {rows.filter((a) => a.sector === sector).length} {sectorName[sector].toLowerCase()}{' '}
              assets in the scenario
            </span>
            <span>Illustration · no telemetry</span>
          </div>
        </Panel>
        <Panel
          title="Risk distribution"
          aside={<SampleBadge>Preview</SampleBadge>}
          className="distribution-panel"
        >
          <div className="risk-donut">
            <ResponsiveContainer width="100%" height={154}>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  innerRadius={54}
                  outerRadius={67}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={5}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {distribution.map((d) => (
                    <Cell key={d.name} fill={`var(--risk-${d.name})`} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  formatter={(v) => [`${v} sample labels`, 'Preview']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{priority.length}</strong>
              <small>SAMPLE LABELS</small>
            </div>
          </div>
          <div className="distribution-legend">
            {distribution.map((d) => (
              <div key={d.name}>
                <span>
                  <i className={`legend-dot ${d.name}`} />
                  {d.name}
                </span>
                <strong className="mono">{d.value.toString().padStart(2, '0')}</strong>
              </div>
            ))}
          </div>
          <div className="panel-footnote">
            {rows.length - priority.length} assets without a preview label.
            <br />
            All calculated assessments are unavailable.
          </div>
        </Panel>
      </div>
      <div className="overview-bottom">
        <Panel
          title="Priority assets"
          aside={
            <div className="inline-items">
              <SampleBadge>Illustrative ranking</SampleBadge>
              <TextLink to="/assets">View register</TextLink>
            </div>
          }
          className="priority-panel"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ASSET / IDENTIFIER</th>
                  <th>SECTOR</th>
                  <th>DEMO RISK</th>
                  <th>PREVIEW INDEX</th>
                  <th>
                    <span className="sr-only">Inspect</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {priority.slice(0, 4).map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <button className="asset-name" onClick={() => setSelected(asset.id)}>
                        {asset.name}
                      </button>
                      <small className="mono muted">{asset.id}</small>
                    </td>
                    <td>
                      <SectorBadge sector={asset.sector} />
                    </td>
                    <td>
                      <RiskBadge category={demoFor(asset.id)?.category} />
                    </td>
                    <td>
                      <div className="score-cell">
                        <span className="mono">{demoFor(asset.id)?.score}</span>
                        <span className="score-track">
                          <i
                            style={{
                              width: `${demoFor(asset.id)?.score}%`,
                              background: `var(--risk-${demoFor(asset.id)?.category})`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Inspect ${asset.name}`}
                        onClick={() => setSelected(asset.id)}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-footnote">
            Preview scores demonstrate the interface. They are not outputs of a risk model.
          </div>
        </Panel>
        <Panel
          title="Essential services"
          aside={<TextLink to="/infrastructure?mode=operational">Dependencies</TextLink>}
        >
          <QueryState
            pending={services.isPending}
            error={services.error}
            retry={services.refetch}
          />
          <div className="services-list">
            {services.data?.map((service) => {
              const Icon = sectorIcons[service.sector]
              return (
                <Link
                  className="service-item"
                  key={service.id}
                  to={`/infrastructure?mode=operational&sector=${service.sector}`}
                >
                  <span className={`service-icon ${service.sector}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{service.name}</strong>
                    <small>
                      {service.requirements.length} requirement groups · Scenario definition
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              )
            })}
          </div>
          <div className="inset-note small-note">
            Dependency definitions include redundancy and backup assumptions. Operational status is
            not monitored.
          </div>
        </Panel>
      </div>
      <Panel
        title="Assessment history"
        aside={
          <span className="subtle-label">
            <Clock3 size={13} />
            SNAPSHOT RECORD
          </span>
        }
        className="history-panel"
      >
        <QueryState
          pending={snapshots.isPending}
          error={snapshots.error}
          retry={snapshots.refetch}
        />
        {snapshots.data?.map((snapshot) => (
          <div className="timeline-row" key={snapshot.snapshot_id}>
            <span className="timeline-node" />
            <div>
              <strong>Baseline scenario initialized</strong>
              <p>30 fictional assets · Three sectors · Two independent relationship graphs</p>
            </div>
            <span className="badge neutral">Inventory snapshot</span>
            <time className="mono" dateTime={snapshot.created_at}>
              {new Date(snapshot.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </time>
          </div>
        ))}
        {snapshots.data?.length === 0 && (
          <EmptyState compact title="No snapshots yet">
            Assessment history will appear after a snapshot is stored.
          </EmptyState>
        )}
        <div className="timeline-pending">
          <span className="timeline-node hollow" />
          <span>Risk assessment history will appear when the scoring engine is connected.</span>
          <span className="subtle-label">PLANNED</span>
        </div>
      </Panel>
      <PreviewNotice />
      <AssetDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  )
}
