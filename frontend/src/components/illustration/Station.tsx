import type { Sector } from '../../api/client'
import { stationArt, stationPartCount } from './station-art'
import './station.css'

export default function Station({ sector }: { sector: Sector }) {
  return (
    <figure
      className="station iso-plate"
      data-focus={sector}
      aria-label={`Original isometric control station. ${sector} cabinet highlighted; conceptual illustration with no telemetry.`}
    >
      <div className="station-meta">
        <span>FIG. 01</span>
        <span>CONTROL STATION</span>
      </div>
      <svg className="iso-svg" viewBox="0 0 580 390" role="img" aria-labelledby="station-title">
        <title id="station-title">
          Three cabinet infrastructure control station with operator console
        </title>
        <g dangerouslySetInnerHTML={{ __html: stationArt }} />
      </svg>
      <figcaption>
        <span>{sector.toUpperCase()} / SELECTED SECTOR</span>
        <span>{stationPartCount} PARTS · SVG</span>
      </figcaption>
    </figure>
  )
}
