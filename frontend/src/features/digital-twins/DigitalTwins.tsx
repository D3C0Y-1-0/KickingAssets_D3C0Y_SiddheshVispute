import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RunSimulationButton } from '../../components/Simulation'
import { AssetDrawer } from '../../components/AssetDrawer'
import { TwinNavProvider } from '../../components/twin/TwinNav'
import { useTwinRisk } from '../../hooks/twinRisk'
import { QueryState } from '../../components/ui'

// 5 Dedicated Anatomy Diagram Viewers
import { SmartCityViewer } from '../../components/smartcity/SmartCityViewer'
import { SubstationViewer } from '../../components/anatomy/SubstationViewer'
import { WaterPlantViewer } from '../../components/waterplant/WaterPlantViewer'
import { TransitViewer } from '../../components/transit/TransitViewer'
import { HospitalViewer } from '../../components/hospital/HospitalViewer'

import { INITIAL_DEMO_ASSETS } from '../../data/demoAssets'
import { TWIN_VIEW_LABEL, viewOfPart, type TwinView } from '../../data/twinParts'
import { InfrastructureAsset } from '../../types/infrastructure'

const VIEWS: { id: TwinView; prefix: string | null }[] = [
  { id: 'smartcity', prefix: null },
  { id: 'power', prefix: 'PWR' },
  { id: 'water', prefix: 'WTR' },
  { id: 'transit', prefix: '' },
  { id: 'hospital', prefix: 'HLT' },
]

const isView = (v: string | null): v is TwinView => VIEWS.some((x) => x.id === v)

export default function DigitalTwins() {
  // The open diagram and part live in the URL so they can be linked to from other screens.
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const activeTab: TwinView = isView(requested) ? requested : 'smartcity'
  const requestedPart = params.get('part')
  const [selectedAsset, setSelectedAsset] = useState<InfrastructureAsset | null>(
    INITIAL_DEMO_ASSETS[0],
  )
  const [drawerAsset, setDrawerAsset] = useState<string | null>(null)
  const assets = INITIAL_DEMO_ASSETS
  const { run, risk, error, pending, retry } = useTwinRisk()
  const prefix = VIEWS.find((v) => v.id === activeTab)?.prefix
  const flagged = (run?.assets ?? []).filter(
    (a) =>
      (prefix === null || (prefix && a.asset_id.startsWith(prefix))) &&
      (a.risk.category === 'critical' || a.risk.category === 'high'),
  )

  const setView = useCallback(
    (view: TwinView, part?: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('view', view)
          if (part) next.set('part', part)
          else next.delete('part')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const nav = useMemo(
    () => ({
      requestedPart,
      openPart: (part: string) => setView(viewOfPart(part) ?? activeTab, part),
      openAsset: setDrawerAsset,
      diagram: {
        value: activeTab,
        options: VIEWS.map((v) => ({ id: v.id, label: TWIN_VIEW_LABEL[v.id] })),
        onChange: (id: string) => setView(id as TwinView),
      },
    }),
    [requestedPart, setView, activeTab],
  )

  return (
    <TwinNavProvider value={nav}>
      <div className="twin-page">
        <h1 className="sr-only">Digital twins</h1>
        <div className="twin-bar">
          <label className="twin-bar-field">
            <span>Diagram</span>
            <select
              className="twin-select"
              aria-label="Choose digital twin diagram"
              value={activeTab}
              onChange={(e) => setView(e.target.value as TwinView)}
            >
              {VIEWS.map((v) => (
                <option key={v.id} value={v.id}>
                  {TWIN_VIEW_LABEL[v.id]}
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
              <button
                key={a.asset_id}
                className={`twin-risk-chip ${a.risk.category}`}
                onClick={() => setDrawerAsset(a.asset_id)}
                title={`Open ${a.asset_id}`}
              >
                <span className="relative inline-block w-3 h-3">
                  <span className={`twin-radar ${a.risk.category}`} aria-hidden>
                    <i />
                    <b />
                  </span>
                </span>
                <span className="font-mono">{a.asset_id}</span>
                <strong className="font-mono">{a.risk.score?.toFixed(1)}</strong>
              </button>
            ))}
            {flagged.length > 4 && <span>+{flagged.length - 4} more</span>}
          </div>
          <RunSimulationButton
            variant={run ? 'secondary' : 'primary'}
            label={run ? 'Re-run' : 'Run simulation'}
          />
        </div>

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
      <AssetDrawer id={drawerAsset} onClose={() => setDrawerAsset(null)} />
    </TwinNavProvider>
  )
}
