import type { ReactNode } from 'react'
import { ArrowUpRight, CircleAlert, Database, LoaderCircle, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Category } from '../lib/risk'
import type { Sector } from '../api/client'

export const sectorName: Record<Sector, string> = {
  power: 'Power',
  water: 'Water',
  healthcare: 'Healthcare',
}
export function SampleBadge({ children = 'Sample data' }: { children?: ReactNode }) {
  return (
    <span className="badge sample">
      <span className="status-dot" />
      {children}
    </span>
  )
}
export function RiskBadge({ category }: { category?: Category | null }) {
  return (
    <span className={`risk-badge ${category ?? 'unassessed'}`}>
      <span className="status-dot" />
      {category ?? 'Unassessed'}
    </span>
  )
}
export function SectorBadge({ sector }: { sector: Sector }) {
  return (
    <span className={`sector-label ${sector}`}>
      <span className="sector-dot" />
      {sectorName[sector]}
    </span>
  )
}
export function Panel({
  title,
  aside,
  children,
  className = '',
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
export function PageHeading({
  eyebrow = 'AURORA CITY / WORKSPACE',
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  )
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={14} />
    </Link>
  )
}
export function EmptyState({
  title,
  children,
  compact = false,
}: {
  title: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <div className="empty-icon">
        <Database size={22} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
export function QueryState({
  pending,
  error,
  retry,
  empty = false,
}: {
  pending: boolean
  error: Error | null
  retry?: () => unknown
  empty?: boolean
}) {
  if (error)
    return (
      <div className="query-state error" role="alert">
        <CircleAlert size={24} />
        <h2>Unable to load scenario data</h2>
        <p>{error.message}</p>
        {retry && (
          <button className="button secondary" onClick={() => void retry()}>
            <RotateCw size={15} />
            Retry connection
          </button>
        )}
      </div>
    )
  if (pending)
    return (
      <div className="query-state" role="status">
        <LoaderCircle className="spin" size={25} />
        <h2>Loading scenario inventory</h2>
        <p>Connecting to the local Gridinal API.</p>
      </div>
    )
  if (empty)
    return (
      <EmptyState title="No records in this view">
        Adjust the filters or select another scenario.
      </EmptyState>
    )
  return null
}
export function PreviewNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="preview-notice">
      <CircleAlert size={16} />
      <span>
        {children ??
          'Design preview only. Scores are illustrative fixtures; the assessment engine is not implemented.'}
      </span>
    </div>
  )
}
