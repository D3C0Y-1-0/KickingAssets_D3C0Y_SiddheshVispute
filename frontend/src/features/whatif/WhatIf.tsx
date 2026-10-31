import { useState } from 'react'
import { ArrowRight, Check, FlaskConical, LockKeyhole, Plus, Trash2 } from 'lucide-react'
import { useAssets } from '../../hooks/queries'
import { actionCatalog } from '../../fixtures/previews'
import { PageHeading, Panel, PreviewNotice, QueryState, SectorBadge } from '../../components/ui'
import type { Models } from '../../api/client'

type Staged = Models['StagedAction']
export default function WhatIf() {
  const assets = useAssets()
  const [assetId, setAssetId] = useState('')
  const [staged, setStaged] = useState<Staged[]>([])
  const active = assets.data?.find((a) => a.id === assetId)
  const applicable = actionCatalog.filter(
    (action) =>
      active &&
      (action.type === 'patch_review'
        ? active.security.patch_status !== 'current'
        : action.applicable(active.security.mfa_enabled, active.security.remote_access)),
  )
  const add = (action_type: Staged['action_type']) =>
    setStaged((previous) =>
      previous.some((a) => a.asset_id === assetId && a.action_type === action_type)
        ? previous
        : [...previous, { asset_id: assetId, action_type }],
    )
  return (
    <>
      <PageHeading
        title="What-If lab"
        description="Stage a preventive action. Understand its assumptions before estimating its effect."
        actions={
          <span className="badge neutral">
            <FlaskConical size={13} />
            SCENARIO WORKBENCH
          </span>
        }
      />
      <PreviewNotice>
        Interface foundation. Staging is local and temporary. Recalculation is unavailable; no
        infrastructure changes are applied.
      </PreviewNotice>
      <div className="whatif-layout">
        <div>
          <Panel title="01 / Select a target asset">
            <QueryState pending={assets.isPending} error={assets.error} retry={assets.refetch} />
            <div className="panel-padding">
              <label className="field-label" htmlFor="whatif-asset">
                Infrastructure asset
              </label>
              <select
                id="whatif-asset"
                className="full-width"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">Choose an asset…</option>
                {assets.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.name}
                  </option>
                ))}
              </select>
              {active && (
                <div className="selected-asset-summary">
                  <SectorBadge sector={active.sector} />
                  <h3>{active.name}</h3>
                  <p>
                    {active.security.network_zone} · {active.criticality} · {active.exposure}{' '}
                    exposure
                  </p>
                  <span className="subtle-label">CONFIGURATION SOURCE: SCENARIO ASSUMPTION</span>
                </div>
              )}
            </div>
          </Panel>
          <Panel
            title="02 / Review preventive actions"
            aside={<span className="subtle-label">CONFIGURATION-BASED OPTIONS</span>}
            className="spaced-panel"
          >
            <div className="panel-padding">
              {!active ? (
                <div className="quiet-placeholder">
                  Select a target to see actions applicable to its fictional configuration.
                </div>
              ) : applicable.length === 0 ? (
                <div className="quiet-placeholder">
                  No catalog actions match this configuration. This does not establish that the
                  asset is secure.
                </div>
              ) : (
                applicable.map((action) => {
                  const isStaged = staged.some(
                    (a) => a.asset_id === assetId && a.action_type === action.type,
                  )
                  return (
                    <div className="action-option" key={action.type}>
                      <div className="action-option-heading">
                        <LockKeyhole size={18} />
                        <h3>{action.name}</h3>
                      </div>
                      <p>{action.description}</p>
                      <dl className="action-meta">
                        <dt>Effort</dt>
                        <dd>{action.effort}</dd>
                        <dt>Operational considerations</dt>
                        <dd>{action.disruption}</dd>
                      </dl>
                      <button
                        className={`button ${isStaged ? 'secondary' : 'primary'}`}
                        disabled={isStaged}
                        onClick={() => add(action.type)}
                      >
                        {isStaged ? <Check size={14} /> : <Plus size={14} />}
                        {isStaged ? 'Staged locally' : 'Stage hypothetical action'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </Panel>
        </div>
        <div>
          <Panel
            title="03 / Hypothesis staging"
            aside={<span className="badge neutral">{staged.length} STAGED</span>}
          >
            <div className="panel-padding">
              {staged.length === 0 ? (
                <div className="quiet-placeholder">
                  Your staged actions will appear here. Nothing is persisted or executed.
                </div>
              ) : (
                staged.map((a) => (
                  <div className="staged-row" key={`${a.asset_id}-${a.action_type}`}>
                    <div>
                      <small className="mono mint">{a.asset_id}</small>
                      <strong>{actionCatalog.find((c) => c.type === a.action_type)?.name}</strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${a.action_type} for ${a.asset_id}`}
                      onClick={() => setStaged((previous) => previous.filter((s) => s !== a))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
              <div className="comparison-grid">
                <div>
                  <span className="eyebrow">CURRENT RISK</span>
                  <strong>—</strong>
                  <small>Not assessed</small>
                </div>
                <ArrowRight size={20} />
                <div>
                  <span className="eyebrow">PROJECTED RISK</span>
                  <strong>—</strong>
                  <small>Not calculated</small>
                </div>
              </div>
              <div className="inset-note">
                Per-action effects and service disruption require a calculated baseline and a
                versioned what-if engine.
              </div>
              <button
                className="button primary full-width simulation-button"
                disabled
                title="The recalculation engine is planned for a later phase"
              >
                <FlaskConical size={16} />
                Simulation unavailable in Phase 1
              </button>
              <p className="small muted">
                Current → projected does not imply verified. Any future verification requires
                independent evidence.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
