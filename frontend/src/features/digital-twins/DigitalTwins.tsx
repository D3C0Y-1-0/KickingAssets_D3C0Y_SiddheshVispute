import { useState } from 'react'
import { RunSimulationButton } from '../../components/Simulation'
import { useTwinRisk } from '../../hooks/twinRisk'
import { QueryState } from '../../components/ui'

// 5 Dedicated Anatomy Diagram Viewers
import { SmartCityViewer } from '../../components/smartcity/SmartCityViewer'
import { SubstationViewer } from '../../components/anatomy/SubstationViewer'
import { WaterPlantViewer } from '../../components/waterplant/WaterPlantViewer'
import { TransitViewer } from '../../components/transit/TransitViewer'
import { HospitalViewer } from '../../components/hospital/HospitalViewer'

import { INITIAL_DEMO_ASSETS } from '../../data/demoAssets'
import { InfrastructureAsset } from '../../types/infrastructure'

type TwinMode = 'smartcity' | 'power' | 'water' | 'transit' | 'hospital'

const VIEWS: { id: TwinMode; label: string; prefix: string | null }[] = [
  { id: 'smartcity', label: 'Smart City (integrated)', prefix: null },
  { id: 'power', label: 'Power grid & substation', prefix: 'PWR' },
  { id: 'water', label: 'Water treatment', prefix: 'WTR' },
  { id: 'transit', label: 'Transit & rail', prefix: '' },
  { id: 'hospital', label: 'Trauma hospital', prefix: 'HLT' },
]

export default function DigitalTwins() {
  const [activeTab, setActiveTab] = useState<TwinMode>('smartcity')
  const [selectedAsset, setSelectedAsset] = useState<InfrastructureAsset | null>(
    INITIAL_DEMO_ASSETS[0],
  )
  const assets = INITIAL_DEMO_ASSETS
  const { run, risk, error, pending, retry } = useTwinRisk()
  const prefix = VIEWS.find((v) => v.id === activeTab)?.prefix
  const flagged = (run?.assets ?? []).filter(
    (a) =>
      (prefix === null || (prefix && a.asset_id.startsWith(prefix))) &&
      (a.risk.category === 'critical' || a.risk.category === 'high'),
  )

  return (
    <div className="twin-page">
      <div className="twin-bar">
        <label className="twin-bar-field">
          <span>Diagram</span>
          <select
            className="twin-select"
            aria-label="Choose digital twin diagram"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TwinMode)}
          >
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className="twin-bar-alerts">
          {!run && (
            <span>
              {pending
                ? 'Checking calculated risk…'
                : error
                  ? 'Calculated risk unavailable'
                  : 'Run the simulation to light up the twin'}
            </span>
          )}
          {run && activeTab === 'transit' && (
            <span>Transit is not part of the scored scenario</span>
          )}
          {run && activeTab !== 'transit' && flagged.length === 0 && (
            <span>No high or critical assets here</span>
          )}
          {flagged.slice(0, 4).map((a) => (
            <span key={a.asset_id} className={`twin-risk-chip ${a.risk.category}`}>
              <span className="relative inline-block w-3 h-3">
                <span className={`twin-radar ${a.risk.category}`} aria-hidden>
                  <i />
                  <b />
                </span>
              </span>
              <span className="font-mono">{a.asset_id}</span>
              <strong className="font-mono">{a.risk.score?.toFixed(1)}</strong>
            </span>
          ))}
          {flagged.length > 4 && <span>+{flagged.length - 4} more</span>}
        </div>
        <RunSimulationButton
          variant={run ? 'secondary' : 'primary'}
          label={run ? 'Re-run' : 'Run simulation'}
        />
      </div>

      <p className="twin-scenario-note">
        Illustrative diagrams: readings, operational labels and criticality values are static
        scenario assumptions, not telemetry. Only labelled calculated-risk badges come from the
        calculated workflow.
      </p>
      {error && <QueryState pending={false} error={error} retry={retry} />}
      <div className="twin-stage">
        {activeTab === 'smartcity' && (
          <SmartCityViewer
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            risk={risk}
          />
        )}
        {activeTab === 'power' && (
          <SubstationViewer
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            risk={risk}
          />
        )}
        {activeTab === 'water' && <WaterPlantViewer risk={risk} />}
        {activeTab === 'transit' && <TransitViewer />}
        {activeTab === 'hospital' && <HospitalViewer risk={risk} />}
      </div>
    </div>
  )
}
