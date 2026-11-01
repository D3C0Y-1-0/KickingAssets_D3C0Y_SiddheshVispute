import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, socStream, type Models } from '../../api/client'
import { actionable, severityOf } from './evidence'

type Analysis = {
  event: Models['SocEvent']
  pending: boolean
  data: Models['SocAnalysis'] | null
  error: string
}

function merge(a: Models['SocEvent'][], b: Models['SocEvent'][]) {
  return [...new Map([...a, ...b].map((e) => [e.id, e])).values()]
    .sort((x, y) => x.id - y.id)
    .slice(-500)
}
function useLiveSecurity() {
  const client = useQueryClient()
  const snapshot = useQuery({
    queryKey: ['soc', 'snapshot'],
    queryFn: api.socSnapshot,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const [events, setEvents] = useState<Models['SocEvent'][]>([])
  const [connection, setConnection] = useState('Connecting')
  const [epoch, setEpoch] = useState(0)
  const [incident, setIncident] = useState<Models['SocEvent'] | null>(null)
  const [alert, setAlert] = useState<Models['SocEvent'] | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [autoOpen, setAutoOpen] = useState(true)
  const [notificationState, setNotificationState] = useState(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
      ? 'Browser notifications granted'
      : 'Browser notifications off',
  )
  const seen = useRef(0)
  const groups = useRef(new Map<string, number>())
  const baseline = useRef<Promise<Models['SimulationRun']> | null>(null)
  const latest = useQuery({
    queryKey: ['simulation', 'latest'],
    queryFn: () => api.latestRun(),
    enabled: !!snapshot.data,
    retry: false,
    staleTime: 15000,
  })
  const stale =
    !!analysis?.data &&
    (latest.isError ||
      !latest.data ||
      latest.data.id !== analysis.data.run_id ||
      latest.data.fingerprint !== analysis.data.baseline_fingerprint)

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      setNotificationState('Browser notifications unavailable; in-app alerts remain active')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setNotificationState(`Browser notifications ${permission}`)
    } catch {
      setNotificationState('Browser notifications unavailable; in-app alerts remain active')
    }
  }

  useEffect(() => {
    if (!snapshot.data || snapshot.isError) {
      setEvents([])
      setConnection('Operator session required')
      setIncident(null)
      setAnalysis(null)
      setAlert(null)
      return
    }
    setEvents((old) => merge(old, snapshot.data.events))
    seen.current = Math.max(seen.current, snapshot.data.cursor)
    setConnection('Connecting')
    return socStream(
      snapshot.data.cursor,
      (e) => {
        setEvents((old) => merge(old, [e]))
        if (e.id <= seen.current) return
        seen.current = e.id
        if (!actionable(e)) return
        const key = `${e.asset_id}:${e.source_ip}:${e.category}:${e.outcome}:${severityOf(e)}`
        const now = Date.now()
        for (const [k, time] of groups.current) if (now - time >= 10000) groups.current.delete(k)
        if (groups.current.has(key)) return
        groups.current.set(key, now)
        setIncident(e)
        if (['critical', 'high'].includes(severityOf(e))) {
          setAlert(e)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`${severityOf(e).toUpperCase()} · ${e.asset_id}`, {
                body: `${e.source_ip} · ${e.explanation}`,
                tag: `gridinal-${e.asset_id}-${e.category}`,
              })
            } catch {
              /* In-app alert remains available. */
            }
          }
        }
      },
      setConnection,
      () => {
        void snapshot.refetch().finally(() => setEpoch((n) => n + 1))
      },
    )
  }, [snapshot.data, snapshot.isError, epoch])
  useEffect(() => {
    if (!incident || !snapshot.data || snapshot.isError) return
    let cancelled = false
    setAnalysis({ event: incident, pending: true, data: null, error: '' })
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          let run = await api.latestRun()
          if (!run) {
            if (!baseline.current) {
              baseline.current = (async () => {
                const scenario = (await api.scenarios()).find((s) => s.id === 'aurora-city')
                if (!scenario) throw new Error('Aurora City context is unavailable.')
                return api.runSimulation({
                  scenario_id: scenario.id,
                  snapshot_id: scenario.current_snapshot_id,
                })
              })().finally(() => {
                baseline.current = null
              })
            }
            run = await baseline.current
          }
          if (cancelled) return
          client.setQueryData(['simulation', 'latest'], run)
          const data = await api.socAnalyze({
            event_id: incident.id,
            scenario_id: run.scenario_id,
            snapshot_id: run.snapshot_id,
            run_id: run.id,
            baseline_fingerprint: run.fingerprint,
          })
          if (!cancelled) setAnalysis({ event: incident, pending: false, data, error: '' })
        } catch (e) {
          if (!cancelled)
            setAnalysis({
              event: incident,
              pending: false,
              data: null,
              error: e instanceof Error ? e.message : 'Incident analysis failed',
            })
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [incident, snapshot.isError, !!snapshot.data, client])
  return {
    snapshot,
    events,
    connection,
    analysis,
    stale,
    alert,
    autoOpen,
    setAutoOpen,
    dismissAlert: () => setAlert(null),
    enableNotifications,
    notificationState,
    retryAnalysis: () => incident && setIncident({ ...incident }),
    assessEvent: (event: Models['SocEvent']) => setIncident({ ...event }),
  }
}
const SocContext = createContext<ReturnType<typeof useLiveSecurity> | null>(null)
export function SocProvider({ children }: { children: ReactNode }) {
  const value = useLiveSecurity()
  return <SocContext.Provider value={value}>{children}</SocContext.Provider>
}
export function useSoc() {
  const value = useContext(SocContext)
  if (!value) throw new Error('SOC provider is required')
  return value
}
