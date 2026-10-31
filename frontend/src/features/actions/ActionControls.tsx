import { useId, useState } from 'react'
import { ApiError, type ActionType, type Models } from '../../api/client'
import { actionNames, constraintIssues, type Constraints, type StagedAction } from './workflow'

export function ActionError({ error }: { error: Error }) {
  return (
    <div className="run-error" role="alert">
      <strong>{error.message}</strong>
      {error instanceof ApiError && (
        <>
          <small>
            HTTP {error.status} · {error.code}
          </small>
          {error.issues.length ? (
            <ul>
              {error.issues.map((issue, index) => (
                <li key={index}>
                  <code>{issue.path}</code> · {issue.code}: {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function ConstraintsEditor({
  value,
  onChange,
}: {
  value: Constraints | null
  onChange: (next: Constraints | null) => void
}) {
  const id = useId()
  const [first, setFirst] = useState<ActionType>('network_segmentation')
  const [second, setSecond] = useState<ActionType>('access_control')
  const [ruleKind, setRuleKind] = useState('incompatible')
  const rules = value ?? {}
  const change = (next: Constraints) => onChange(next)
  return (
    <fieldset className="workflow-constraints">
      <legend>Operational constraints</legend>
      <p className="small muted">
        Optional planning assumptions in hours. These are limits, not a calendar or a process-safety
        guarantee.
      </p>
      <label htmlFor={`${id}-window`}>Longest maintenance window per action (hours)</label>
      <input
        id={`${id}-window`}
        type="number"
        min="0.01"
        max="1000"
        step="any"
        value={rules.max_downtime_per_action_hours ?? ''}
        onChange={(e) =>
          change({
            ...rules,
            max_downtime_per_action_hours: e.target.value === '' ? null : Number(e.target.value),
          })
        }
      />
      <label htmlFor={`${id}-total`}>Maximum total downtime (hours)</label>
      <input
        id={`${id}-total`}
        type="number"
        min="0"
        max="100000"
        step="any"
        value={rules.max_total_downtime_hours ?? ''}
        onChange={(e) =>
          change({
            ...rules,
            max_total_downtime_hours: e.target.value === '' ? null : Number(e.target.value),
          })
        }
      />
      <details>
        <summary>Action compatibility and prerequisites</summary>
        <p className="small muted">
          Rules apply to actions on the same asset. The optimizer includes required prerequisites;
          What-If rejects selections missing them.
        </p>
        <label htmlFor={`${id}-kind`}>Rule type</label>
        <select id={`${id}-kind`} value={ruleKind} onChange={(e) => setRuleKind(e.target.value)}>
          <option value="incompatible">Cannot combine</option>
          <option value="prerequisites">Requires</option>
        </select>
        <label htmlFor={`${id}-first`}>Action</label>
        <select
          id={`${id}-first`}
          value={first}
          onChange={(e) => setFirst(e.target.value as ActionType)}
        >
          {Object.entries(actionNames).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-second`}>
          {ruleKind === 'incompatible' ? 'Incompatible action' : 'Required action'}
        </label>
        <select
          id={`${id}-second`}
          value={second}
          onChange={(e) => setSecond(e.target.value as ActionType)}
        >
          {Object.entries(actionNames).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button secondary"
          disabled={
            first === second ||
            (rules.incompatible?.length ?? 0) + (rules.prerequisites?.length ?? 0) >= 20
          }
          onClick={() => {
            if (ruleKind === 'incompatible') {
              if (
                !(rules.incompatible ?? []).some(
                  (p) =>
                    (p.first === first && p.second === second) ||
                    (p.first === second && p.second === first),
                )
              )
                change({
                  ...rules,
                  incompatible: [...(rules.incompatible ?? []), { first, second }],
                })
            } else if (
              !(rules.prerequisites ?? []).some((p) => p.action === first && p.requires === second)
            )
              change({
                ...rules,
                prerequisites: [
                  ...(rules.prerequisites ?? []),
                  { action: first, requires: second },
                ],
              })
          }}
        >
          Add action rule
        </button>
      </details>
      <ul className="list-plain">
        {rules.incompatible?.map((pair, i) => (
          <li key={`i-${i}`}>
            {actionNames[pair.first]} cannot combine with {actionNames[pair.second]}{' '}
            <button
              type="button"
              className="button secondary"
              aria-label={`Remove incompatibility ${i + 1}`}
              onClick={() =>
                change({
                  ...rules,
                  incompatible: rules.incompatible?.filter((_, index) => i !== index),
                })
              }
            >
              Remove
            </button>
          </li>
        ))}
        {rules.prerequisites?.map((rule, i) => (
          <li key={`p-${i}`}>
            {actionNames[rule.action]} requires {actionNames[rule.requires]}{' '}
            <button
              type="button"
              className="button secondary"
              aria-label={`Remove prerequisite ${i + 1}`}
              onClick={() =>
                change({
                  ...rules,
                  prerequisites: rules.prerequisites?.filter((_, index) => i !== index),
                })
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {constraintIssues(value).map((issue) => (
        <p className="run-error" role="alert" key={issue}>
          {issue}
        </p>
      ))}
      {value && (
        <button type="button" className="button secondary" onClick={() => onChange(null)}>
          Clear constraints
        </button>
      )}
    </fieldset>
  )
}

export function PatchEditor({
  action,
  onChange,
  candidates,
}: {
  action: StagedAction
  onChange: (next: StagedAction) => void
  candidates: Models['CandidateCve'][]
}) {
  const id = useId()
  const [cvesText, setCvesText] = useState(action.cve_ids?.join(', ') ?? '')
  return (
    <fieldset className="workflow-patch">
      <legend>Patch parameters · {action.asset_id}</legend>
      <label htmlFor={`${id}-cves`}>Patch CVE IDs for {action.asset_id} (optional)</label>
      <input
        id={`${id}-cves`}
        type="text"
        value={cvesText}
        placeholder="CVE-2022-0778, …"
        onChange={(e) => {
          setCvesText(e.target.value)
          onChange({
            ...action,
            cve_ids: e.target.value.trim()
              ? e.target.value
                  .toUpperCase()
                  .split(/[\s,]+/)
                  .filter(Boolean)
              : null,
          })
        }}
      />
      <label htmlFor={`${id}-target`}>Target version for {action.asset_id} (optional)</label>
      <input
        id={`${id}-target`}
        type="text"
        maxLength={64}
        value={action.target_version ?? ''}
        placeholder="Enter the version to evaluate"
        onChange={(e) => onChange({ ...action, target_version: e.target.value || null })}
      />
      <p className="small muted">
        Blank CVEs use the backend's documented-fix batch. A target version is evaluated against NVD
        affected ranges; this does not verify installation or vendor compatibility.
      </p>
      <details>
        <summary>Known candidate CVEs shown in this simulation</summary>
        <ul>
          {candidates.map((cve) => (
            <li key={cve.cve_id}>
              {cve.cve_id} · {cve.applicability}
            </li>
          ))}
        </ul>
        <p className="small muted">
          The run shows top candidates only; other IDs are checked by the backend.
        </p>
      </details>
    </fieldset>
  )
}

export function PatchEvidence({ patch }: { patch?: Models['PatchOutcome'] | null }) {
  if (!patch) return null
  return (
    <details className="workflow-patch-evidence">
      <summary>
        Patch evidence · {patch.remediated.length} remediated / {patch.not_remediated.length}{' '}
        unresolved
      </summary>
      <p>
        Scope: {patch.scope}
        {patch.target_version ? ` · target ${patch.target_version}` : ''}. Modelled remediation, not
        verified installation.
      </p>
      <ul className="list-plain">
        {[...patch.remediated, ...patch.not_remediated].map((item) => (
          <li key={item.cve_id}>
            <strong>{item.cve_id}</strong> · {item.status} · {item.applicability}
            <small>
              Fixed in: {item.fixed_in ?? 'not documented'} · {item.reason}
            </small>
          </li>
        ))}
      </ul>
    </details>
  )
}
