import type { Models } from '../../api/client'

export function severityOf(event: Models['SocEvent']) {
  // Older retained v1 disclosures remain readable without rewriting historical evidence.
  return event.outcome === 'unauthorized_read' ? 'critical' : event.severity
}

export function confirmed(event: Models['SocEvent']) {
  return (
    event.outcome === 'unauthorized_read' ||
    (event.category === 'authentication.success' && event.severity === 'high')
  )
}

export function actionable(event: Models['SocEvent']) {
  return (
    !!event.asset_id &&
    event.path.startsWith(`/nodes/${event.asset_id}/`) &&
    severityOf(event) !== 'info'
  )
}

/** A visual evidence overlay, not risk scoring or failure propagation. */
export function mapEvidence(
  events: Models['SocEvent'][],
  edges: { source_asset_id: string; target_asset_id: string; id: string }[],
  mode: 'cyber' | 'operational',
) {
  const marks = new Map<string, { token: string; explanation: string; event: Models['SocEvent'] }>()
  for (const event of events.filter(actionable)) {
    const id = event.asset_id!
    if (!marks.has(id) || confirmed(event) || marks.get(id)?.token !== '--risk-critical') {
      marks.set(id, {
        token: confirmed(event) ? '--risk-critical' : '--risk-high',
        explanation: `${confirmed(event) ? 'Confirmed demo-service access/disclosure' : 'Observed attempt or policy alert; no compromise established'} · event #${event.id} · ${event.source_ip} · ${event.explanation}`,
        event,
      })
    }
  }
  // Only directed, actual edges from nodes with confirmed evidence. Never invent neighbours
  // or treat orange adjacency as a successful pivot, a verified vulnerability or an outage.
  for (const event of events.filter((e) => actionable(e) && confirmed(e))) {
    for (const edge of edges.filter((e) => e.source_asset_id === event.asset_id)) {
      if (marks.has(edge.target_asset_id)) continue
      marks.set(edge.target_asset_id, {
        token: '--risk-high',
        explanation:
          mode === 'cyber'
            ? `Potential exposure via configured cyber edge ${edge.id} from ${event.asset_id}. Connectivity is not compromise; no vulnerability or successful pivot established.`
            : `Conditional operational dependency ${edge.id} from provider ${event.asset_id}. A disclosure does not establish provider failure or dependent disruption.`,
        event,
      })
    }
  }
  return marks
}
