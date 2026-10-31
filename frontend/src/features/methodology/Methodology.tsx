import { ArrowRight, BookOpen, Check, Circle, Network, Shield } from 'lucide-react'
import { PageHeading, Panel, SampleBadge } from '../../components/ui'

const status = [
  { name: 'Deterministic scenario & SQLite persistence', done: true },
  { name: 'Typed inventory APIs & asset inspection', done: true },
  { name: 'Independent cyber & operational graphs', done: true },
  { name: 'Real KEV / NVD / EPSS ingestion with a source manifest', done: true },
  { name: 'ML KEV-prioritization signal with leakage controls and baselines', done: true },
  { name: 'Live simulation: candidate CVEs scored by the model', done: true },
  { name: 'Conditional service impact over reachability and dependencies', done: true },
  { name: 'What-if recalculation and greedy remediation plan', done: true },
  { name: 'Confirmed CVE applicability (needs real product versions)', done: false },
  { name: 'Verification of real changes (needs independent evidence)', done: false },
  { name: 'Live monitoring or real incident prediction', done: false },
]

export default function Methodology() {
  return (
    <>
      <PageHeading
        title="Methodology & evidence"
        description="Know what is observed, what is assumed, and what has yet to be calculated."
        actions={<SampleBadge>Prototype v0.2</SampleBadge>}
      />
      <div className="methodology-intro">
        <span className="empty-icon">
          <Shield size={25} />
        </span>
        <div>
          <div className="eyebrow">OUR PURPOSE</div>
          <h2>See the blast radius before the incident.</h2>
          <p>
            GridSentinel is a critical infrastructure cybersecurity risk intelligence platform for
            D3COY PS03. It will support preventive decisions with traceable vulnerability evidence,
            transparent relative risk assessments and conditional service impact estimates. This
            foundation demonstrates the interface and inventory architecture.
          </p>
        </div>
      </div>
      <div className="two-column">
        <Panel title="Why two graphs?" aside={<Network size={17} className="mint" />}>
          <div className="method-section">
            <h3>Cyber reachability</h3>
            <div className="edge-explanation">
              <span>Source asset</span>
              <ArrowRight size={20} />
              <span>Reachable target</span>
            </div>
            <p>
              Directed, technically plausible access under explicit protocol and control
              assumptions. Connectivity does not establish exploitability, successful compromise or
              a measured probability.
            </p>
            <h3>Operational dependencies</h3>
            <div className="edge-explanation operational">
              <span>Provider asset</span>
              <ArrowRight size={20} />
              <span>Dependent asset</span>
            </div>
            <p>
              Power, water, control, data and backup dependencies. A cyber path and a service
              dependency have different meanings and are never combined into one edge schema.
            </p>
            <p>
              Service requirements store k-of-n provider groups, minimum availability, backup
              activation delay and duration. Conditional disruption is computed by the impact engine
              as an upper bound, with each compromise effect an explicit assumption.
            </p>
          </div>
        </Panel>
        <Panel title="Evidence classes" aside={<BookOpen size={17} className="muted" />}>
          <div className="evidence-list">
            <div>
              <span className="evidence-key assumed">ASSUMED</span>
              <p>
                Aurora City assets, products, configurations and service relationships are fictional
                scenario assumptions.
              </p>
            </div>
            <div>
              <span className="evidence-key observed">OBSERVED / CONFIGURED</span>
              <p>
                Reserved for actual supplied observations or configured records. No live
                observations have been collected.
              </p>
            </div>
            <div>
              <span className="evidence-key reference">REFERENCE</span>
              <p>
                Real NVD, CVSS, EPSS and KEV records, with a manifest of exactly which files were
                retrieved and when. Assets are fictional, so a CVE is only ever a candidate for an
                asset's assumed product family, never confirmed.
              </p>
            </div>
            <div>
              <span className="evidence-key model">MODEL / SIMULATION</span>
              <p>
                Model scores, risk indexes and projected effects carry versions and assumptions. The
                projected state is never shown as verified.
              </p>
            </div>
          </div>
        </Panel>
      </div>
      <div className="two-column spaced-panel">
        <Panel title="Risk index ≠ incident probability">
          <div className="method-section">
            <p>
              The 0–100 risk index represents relative review priority under a published formula. It
              does not predict that a real incident will occur, or when.
            </p>
            <p>
              Every score is computed by the backend after a simulation from ML-scored real CVEs,
              exposure and conditional impact. Before a simulation there is no score. Missing is
              never zero.
            </p>
            <h3>Current → Projected → Verified</h3>
            <p>
              Current refers to the assessment of a stored snapshot. Projected represents a
              hypothetical recalculation. Verified requires a dated verification record, a named
              verifier and supporting evidence; staging a change cannot produce verification.
            </p>
          </div>
        </Panel>
        <Panel title="ML evaluation">
          <div className="method-section">
            <p>
              Use versioned reference datasets, time-based train/validation/test splits and
              publication cutoffs to prevent future information leaking into earlier examples.
            </p>
            <p>
              Compare against transparent baselines. Report ranking quality, precision/recall at a
              useful review budget, class imbalance and uncertainty. Use calibration checks only for
              outputs intended to represent probabilities.
            </p>
            <p>
              CVE prioritization quality is evaluated separately from asset-level risk and
              service-impact assumptions. See the ML Lab for the held-out metrics, baselines and
              limits. The model is statistically tied with the EPSS baseline.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Implementation status"
        aside={<span className="subtle-label">HONEST BY DESIGN</span>}
        className="spaced-panel"
      >
        <div className="implementation-grid">
          {status.map((item) => (
            <div key={item.name}>
              {item.done ? (
                <Check size={17} className="mint" />
              ) : (
                <Circle size={15} className="muted" />
              )}
              <span>{item.name}</span>
              <span className={`badge ${item.done ? 'implemented' : 'neutral'}`}>
                {item.done ? 'Implemented' : 'Planned'}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="inset-note spaced-panel">
        No live monitoring, real-world incident prediction, autonomous remediation or actual
        infrastructure changes are provided. The inventory is a fictional snapshot (1 October 2026,
        09:00 UTC); vulnerability data is real and as of the latest local EPSS snapshot.
      </div>
    </>
  )
}
