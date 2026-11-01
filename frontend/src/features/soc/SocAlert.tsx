import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSoc } from './provider'
import { severityOf } from './evidence'
import './soc.css'

export default function SocAlert() {
  const { alert, dismissAlert, analysis, stale, autoOpen } = useSoc()
  const location = useLocation()
  const navigate = useNavigate()
  const opened = useRef(0)
  useEffect(() => {
    if (
      !autoOpen ||
      stale ||
      !analysis?.data ||
      analysis.pending ||
      !analysis.data.projection ||
      opened.current === analysis.event.id
    )
      return
    opened.current = analysis.event.id
    // Prepare globally, but don't interrupt an operator inspecting the map or another workflow.
    if (location.pathname === '/') {
      navigate(`/what-if?soc_event=${analysis.event.id}`)
    }
  }, [analysis, stale, autoOpen, location.pathname, navigate])
  if (!alert) return null
  return (
    <div className={`soc-notification soc-severity-${severityOf(alert)}`} role="alert">
      <strong>
        {severityOf(alert).toUpperCase()} · {alert.asset_id} · {alert.source_ip}
      </strong>
      <p>{alert.explanation}</p>
      <div className="soc-controls">
        <Link to={`/?event=${alert.id}#soc-logs`}>Inspect SOC evidence</Link>
        <Link to={`/infrastructure?focus=${alert.asset_id}`}>View infrastructure</Link>
        <Link to={`/what-if?soc_event=${alert.id}`}>View projected response</Link>
        <button className="button secondary" onClick={dismissAlert}>
          Dismiss alert
        </button>
      </div>
    </div>
  )
}
