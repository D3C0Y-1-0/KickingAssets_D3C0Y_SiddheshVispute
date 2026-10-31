import type { Models } from '../../api/client'

type ActivityDay = Models['ActivityDay']

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 0–4 intensity bucket from the detector's 0–100 activity index. */
function levelOf(index: number): 0 | 1 | 2 | 3 | 4 {
  if (index <= 0) return 0
  if (index < 25) return 1
  if (index < 50) return 2
  if (index < 75) return 3
  return 4
}

/**
 * GitHub-style weekly grid of the real simulated-network-activity index (0-100 per day).
 * Not telemetry from a live network — a detector score over the scenario's simulated events.
 */
export function ActivityHeatmap({ series }: { series: ActivityDay[] }) {
  if (series.length === 0) return null

  // Lay the most recent ~5 weeks out as columns of 7 (Sun-Sat), most recent on the right.
  const byDate = new Map(series.map((d) => [d.day, d]))
  const last = new Date(series[series.length - 1].day + 'T00:00:00Z')
  const days: (ActivityDay | null)[] = []
  const start = new Date(last)
  start.setUTCDate(start.getUTCDate() - 34)
  // Align the first column to a Sunday.
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  for (let i = 0; i < 35; i += 1) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    days.push(byDate.get(key) ?? (key <= series[series.length - 1].day ? { day: key, index: 0, band: 'calm', anomalous_assets: 0 } : null))
  }
  const weeks = Array.from({ length: 5 }, (_, w) => days.slice(w * 7, w * 7 + 7))

  return (
    <div className="heat-grid">
      <div className="heat-grid-rows">
        {DOW.map((label, row) => (
          <div className="heat-grid-row" key={label} style={{ ['--heat-cols' as string]: weeks.length }}>
            <span className="heat-grid-row-label">{label}</span>
            {weeks.map((week, w) => {
              const cell = week[row]
              return cell ? (
                <div
                  key={w}
                  className="heat-cell"
                  data-level={levelOf(cell.index)}
                  title={`${cell.day} · activity ${cell.index.toFixed(0)} · ${cell.band}${cell.anomalous_assets ? ` · ${cell.anomalous_assets} anomalous asset${cell.anomalous_assets === 1 ? '' : 's'}` : ''}`}
                />
              ) : (
                <div key={w} className="heat-cell" style={{ visibility: 'hidden' }} />
              )
            })}
          </div>
        ))}
      </div>
      <div className="heat-grid-foot">
        <div className="heat-legend">
          <i className="heat-cell" data-level="0" />
          <span>calm</span>
        </div>
        <div className="heat-legend">
          <i className="heat-cell" data-level="4" />
          <span>active</span>
        </div>
      </div>
    </div>
  )
}
