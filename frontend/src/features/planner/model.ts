import type { Models } from '../../api/client'
import type { ForceEdge } from '../infrastructure/ForceGraph'
export type Outcome = Models['FailureOutcome']
export type Comparison = Models['Comparison']
export type TimelineEvent = { minute: number; label: string }

export function contains(intervals: Models['Interval'][], minute: number, horizon: number) {
  // A window truncated at the horizon is not evidence of recovery at its boundary.
  const t = Math.min(minute, horizon - 0.001)
  return intervals.some((i) => i.start_minutes <= t && t < i.end_minutes)
}
export function eventsFor(outcome: Outcome): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const add = (minute: number | null, label: string) => {
    if (minute !== null && minute >= 0 && minute < outcome.horizon_minutes)
      events.push({ minute, label })
  }
  for (const asset of outcome.asset_outages)
    for (const interval of asset.intervals) {
      add(interval.start_minutes, `${asset.asset_id}: modelled outage starts`)
      add(interval.end_minutes, `${asset.asset_id}: modelled outage ends`)
    }
  for (const standby of outcome.standbys) {
    const ids = standby.backup_asset_ids.join(', ')
    add(
      standby.activation_minutes,
      `${ids}: scheduled standby window starts; availability required`,
    )
    add(
      standby.exhaustion_minutes,
      `${ids}: scheduled stored-energy window ends (exhaustion limit)`,
    )
    for (const interval of standby.available_intervals) {
      add(interval.start_minutes, `${ids}: modelled standby output available`)
      add(interval.end_minutes, `${ids}: modelled standby output unavailable`)
    }
  }
  for (const service of outcome.services)
    for (const interval of service.intervals) {
      add(interval.start_minutes, `${service.service_id}: service disruption starts`)
      add(interval.end_minutes, `${service.service_id}: service disruption ends`)
    }
  events.push(
    { minute: 0, label: 'Scenario onset' },
    {
      minute: outcome.horizon_minutes,
      label: 'Horizon ends; truncated intervals do not establish recovery',
    },
  )
  return events.sort((a, b) => a.minute - b.minute || a.label.localeCompare(b.label))
}
export function numericIssue(value: string, max: number, integer = false) {
  const n = Number(value)
  return (
    !value.trim() || !Number.isFinite(n) || n < 0 || n > max || (integer && !Number.isInteger(n))
  )
}
export function minutesLost(intervals: Models['Interval'][]) {
  return intervals.reduce((sum, interval) => sum + interval.end_minutes - interval.start_minutes, 0)
}

/** Display scope from reported outages/causal IDs and declared standby edges, never inference. */
export function replayScope(outcome: Outcome, edges: ForceEdge[], directIds: string[]) {
  const reportedEdges = new Set(outcome.asset_outages.flatMap((a) => a.dependency_edge_ids))
  const affected = new Set([...directIds, ...outcome.asset_outages.map((a) => a.asset_id)])
  const standby = new Set(
    outcome.standbys
      .filter((b) => b.activation_minutes !== null || b.available_intervals.length > 0)
      .flatMap((b) => b.backup_asset_ids),
  )
  for (const e of edges) {
    if (reportedEdges.has(e.id) || (e.requirement === 'backup' && standby.has(e.source_asset_id))) {
      affected.add(e.source_asset_id)
      affected.add(e.target_asset_id)
    }
  }
  for (const id of standby) affected.add(id)
  return { affected, standby, reportedEdges }
}
