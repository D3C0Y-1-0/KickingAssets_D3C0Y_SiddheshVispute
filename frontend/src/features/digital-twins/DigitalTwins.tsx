import { useMemo, useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { RunSimulationButton } from '../../components/Simulation'
import { useTwinRisk } from '../../hooks/twinRisk'
import { RUN_MUTATION_KEY, useAssets, useGraph } from '../../hooks/queries'
import { buildTwinAssets } from '../../data/twinAssets'
import { TwinFlow } from './TwinFlow'
import './twin-flow.css'

// 5 Dedicated Anatomy Diagram Viewers
import { SmartCityViewer } from '../../components/smartcity/SmartCityViewer'
import { SubstationViewer } from '../../components/anatomy/SubstationViewer'
import { WaterPlantViewer } from '../../components/waterplant/WaterPlantViewer'
import { TransitViewer } from '../../components/transit/TransitViewer'
import { HospitalViewer } from '../../components/hospital/HospitalViewer'

import type { InfrastructureAsset } from '../../types/infrastructure'

type TwinMode = 'smartcity' | 'power' | 'water' | 'transit' | 'hospital'

const VIEWS: { id: TwinMode; label: string; prefix: string | null; parts: string }[] = [
  { id: 'smartcity', label: 'Smart City (integrated)', prefix: null, parts: 'city-' },
  { id: 'power', label: 'Power grid & substation', prefix: 'PWR', parts: 'sub-' },
  { id: 'water', label: 'Water treatment', prefix: 'WTR', parts: 'water-' },
  { id: 'transit', label: 'Transit & rail', prefix: '', parts: 'transit-' },
  { id: 'hospital', label: 'Trauma hospital', prefix: 'HLT', parts: 'hosp-' },
]

export default function DigitalTwins() {
  const [activeTab, setActiveTab] = useState<TwinMode>('smartcity')
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const { run, risk } = useTwinRisk()
  const scenarioAssets = useAssets()
  const operational = useGraph('operational')
  const scanning = useIsMutating({ mutationKey: RUN_MUTATION_KEY }) > 0
  // The diagrams select real scenario assets, so this panel agrees with every other page.
  const assets = useMemo(
    () => buildTwinAssets(scenarioAssets.data, risk),
    [scenarioAssets.data, risk],
  )
  const selectedAsset =
    assets.find((a) => (a.smartCityComponentId ?? a.substationComponentId) === selectedPart) ?? null
  const select = (asset: InfrastructureAsset) =>
    setSelectedPart(asset.smartCityComponentId ?? asset.substationComponentId ?? null)

  const view = VIEWS.find((v) => v.id === activeTab)
  const prefix = view?.prefix
  const flagged = (run?.assets ?? []).filter(
    (a) =>
      (prefix === null || (prefix && a.asset_id.startsWith(prefix))) &&
      (a.risk.category === 'critical' || a.risk.category === 'high'),
  )
  const flaggedParts = Object.entries(risk).filter(([part]) => part.startsWith(view?.parts ?? '-'))

  return (
    <div className="twin-page">
      <div className="twin-bar">
        <label className="twin-bar-field">
          <span>Diagram</span>
          <select
            className="twin-select"
            aria-label="Choose digital twin diagram"
            value={activeTab}
            onChange={(e) => {
              setActiveTab(e.target.value as TwinMode)
              setSelectedPart(null)
            }}
          >
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className="twin-bar-alerts">
          {scanning && <span className="twin-scanning">Scanning the grid…</span>}
          {!run && !scanning && <span>Run the simulation to light up the twin</span>}
          {run && !scanning && activeTab === 'transit' && (
            <span>Transit is not part of the scored scenario</span>
          )}
          {run && !scanning && activeTab !== 'transit' && flagged.length === 0 && (
            <span>No high or critical assets here</span>
          )}
          {!scanning &&
            flagged.slice(0, 4).map((a, index) => (
              <span
                key={`${run?.id}-${a.asset_id}`}
                className={`twin-risk-chip twin-pop ${a.risk.category}`}
                style={{ ['--pop-delay' as string]: `${index * 150}ms` }}
              >
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
          {!scanning && flagged.length > 4 && <span>+{flagged.length - 4} more</span>}
        </div>
        <RunSimulationButton
          variant={run ? 'secondary' : 'primary'}
          label={run ? 'Re-run' : 'Run simulation'}
        />
      </div>

      <p className="twin-scenario-note">
        Illustrative diagrams of a fictional scenario. Parts are linked to the scenario assets, and
        the ML risk badges and radars come from the latest simulation run. There is no live
        telemetry.
      </p>
      <div className={`twin-stage${scanning ? ' is-scanning' : ''}`}>
        {activeTab === 'smartcity' && (
          <SmartCityViewer
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={select}
            risk={scanning ? {} : risk}
          />
        )}
        {activeTab === 'power' && (
          <SubstationViewer
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={select}
            risk={scanning ? {} : risk}
          />
        )}
        {activeTab === 'water' && <WaterPlantViewer risk={scanning ? {} : risk} />}
        {activeTab === 'transit' && <TransitViewer />}
        {activeTab === 'hospital' && <HospitalViewer risk={scanning ? {} : risk} />}
      </div>
      {run && !scanning && (
        <TwinFlow
          run={run}
          parts={flaggedParts}
          assets={scenarioAssets.data ?? []}
          edges={operational.data?.type === 'operational' ? operational.data.edges : []}
        />
      )}
    </div>
  )
}
