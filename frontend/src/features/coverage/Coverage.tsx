import { Link } from 'react-router-dom'
import { PageHeading, Panel } from '../../components/ui'
import '../insights/insights.css'

type Status = 'Working' | 'Partial' | 'Not implemented'
type Row = { item: string; status: Status; how: string; limit: string; to?: string; where?: string }

const statusClass: Record<Status, string> = {
  Working: 'implemented',
  Partial: 'neutral',
  'Not implemented': 'sample',
}

const objectives: Row[] = [
  {
    item: '1. Infrastructure asset profiling',
    status: 'Working',
    how: '30 fictional power, water and healthcare assets with criticality, exposure, configuration and two separate graphs.',
    limit: 'Simulated estate; not an importer for real inventories.',
    to: '/infrastructure',
    where: 'Infrastructure Map',
  },
  {
    item: '2. Vulnerability assessment',
    status: 'Working',
    how: 'Each asset is assumed to run a real product and version; NVD affected-version ranges decide which real CVEs apply; configuration flags feed exposure.',
    limit: 'Products and versions are assumptions, not scan results.',
    to: '/assets',
    where: 'Asset & Risk Register',
  },
  {
    item: '3. AI-based risk prediction',
    status: 'Partial',
    how: 'A trained model ranks CVEs by resemblance to later KEV additions; composed with exposure and conditional impact into a relative index.',
    limit:
      'Relative ranking, not an incident probability; the model is statistically tied with the EPSS baseline.',
    to: '/ml',
    where: 'ML Lab',
  },
  {
    item: '4. Risk prioritization',
    status: 'Working',
    how: 'Assets are ranked by the index; activity-aware urgency adds a separate priority for assets deviating from baseline.',
    limit: 'Weights are documented modelling choices.',
    to: '/intelligence',
    where: 'Risk Intelligence',
  },
  {
    item: '5. Dependency and impact analysis',
    status: 'Working',
    how: 'Conditional impact engine over operational dependencies with redundancy, named backups and cascades; chokepoints and vendor scenarios.',
    limit: 'No operator recovery, so results are an upper bound.',
    to: '/resilience',
    where: 'Resilience',
  },
  {
    item: '6. Predictive risk dashboard',
    status: 'Working',
    how: 'Overview with risk scores and bands; monthly posture replay; daily simulated activity index; exportable risk brief.',
    limit: 'The trend is a replay against fixed assets; there is no live threat feed.',
    to: '/posture',
    where: 'Posture',
  },
  {
    item: '7. Preventive recommendations',
    status: 'Partial',
    how: 'Patch prioritization, segmentation and access control are modelled with projected reductions and a greedy optimizer. The cheapest set of segmentation cuts that blocks every plausible attacker route is found exactly, and a reaction plan contains a taken-over asset.',
    limit:
      'Monitoring and incident-response planning are recommendations with no modelled reduction.',
    to: '/remediation',
    where: 'Remediation Plan',
  },
]

const challenge: Row[] = [
  {
    item: 'Simulated infrastructure data',
    status: 'Working',
    how: 'Deterministic Aurora City scenario.',
    limit: 'Power, water and healthcare only.',
  },
  {
    item: 'Vulnerability information',
    status: 'Working',
    how: 'Real NVD, CISA KEV and EPSS data from local caches.',
    limit: 'Reference data is a cached snapshot, not a live feed.',
  },
  {
    item: 'Network activity and unusual patterns',
    status: 'Partial',
    how: 'Simulated daily telemetry per asset with authored events and a transparent robust z-score detector.',
    limit: 'Not observed traffic; the detector is exercised on its own simulated events.',
    to: '/posture',
    where: 'Posture',
  },
  {
    item: 'Asset criticality',
    status: 'Working',
    how: 'Essential, important and supporting weights drive the city index and impact.',
    limit: 'Criticality is a scenario assumption.',
  },
  {
    item: 'Compromised vendor / supply chain',
    status: 'Partial',
    how: 'Assumed vendor-compromise scenarios analysed jointly; vendor concentration per service; KEV counts as context.',
    limit: 'No vendor intelligence beyond KEV counts; vendors are assumed products.',
    to: '/resilience',
    where: 'Resilience',
  },
  {
    item: 'Which assets need urgent attention',
    status: 'Working',
    how: 'Risk ranking plus urgency (risk x activity) and chokepoint ranking.',
    limit: 'Relative priorities, not forecasts.',
    to: '/intelligence',
    where: 'Risk Intelligence',
  },
  {
    item: 'Why an asset is high risk, and how a fix lowers overall risk',
    status: 'Working',
    how: 'Per-CVE feature contributions, factor breakdown, what-if recalculation and optimizer.',
    limit: 'Projections are estimates, labelled not verified.',
    to: '/what-if',
    where: 'What-If Lab',
  },
  {
    item: 'Likelihood of an incident',
    status: 'Not implemented',
    how: 'The index is explicitly a relative ranking.',
    limit: 'Calibrated likelihood would need incident outcome data for this estate.',
  },
  {
    item: 'Transportation, telecom and wider smart-city sectors',
    status: 'Not implemented',
    how: 'The scenario covers power, water and healthcare.',
    limit: 'New sectors would change the protected scenario fixture.',
  },
]

const certIn: Row[] = [
  {
    item: 'IoT security',
    status: 'Partial',
    how: 'Sensors and controllers are profiled; configuration flags feed exposure.',
    limit: 'No device firmware or protocol analysis.',
  },
  {
    item: 'Continuous monitoring',
    status: 'Partial',
    how: 'Simulated telemetry and anomaly detection.',
    limit: 'Simulated, not integrated with real sensors.',
  },
  {
    item: 'Vulnerability management',
    status: 'Working',
    how: 'Version-aware CVE matching, ML prioritization, patch prioritization.',
    limit: 'Depends on assumed products.',
  },
  {
    item: 'Supply-chain security',
    status: 'Partial',
    how: 'Vendor concentration and compromise scenarios.',
    limit: 'Assumed vendors; no software bill of materials.',
  },
  {
    item: 'Incident response',
    status: 'Partial',
    how: 'Recommended as an action, with an effort estimate.',
    limit: 'No recovery-time model, so no modelled benefit.',
  },
]

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="table-scroll">
      <table className="ins-table">
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Status</th>
            <th>How it is covered</th>
            <th>Limit</th>
            <th>See</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item}>
              <td>
                <strong>{r.item}</strong>
              </td>
              <td>
                <span className={`badge ${statusClass[r.status]}`}>{r.status}</span>
              </td>
              <td>{r.how}</td>
              <td className="muted">{r.limit}</td>
              <td>
                {r.to ? (
                  <Link className="text-link" to={r.to}>
                    {r.where}
                  </Link>
                ) : (
                  <span className="faint">n/a</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Coverage() {
  const count = (rows: Row[], status: Status) => rows.filter((r) => r.status === status).length
  const all = [...objectives, ...challenge, ...certIn]
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / COVERAGE"
        title="Challenge coverage"
        description="Each official objective, Challenge clause and CERT-In area mapped to what the product does and where it stops."
      />
      <div className="ins-metrics">
        <div className="ins-metric">
          <div className="label">Working</div>
          <div className="value">{count(all, 'Working')}</div>
          <div className="foot">of {all.length} requirements</div>
        </div>
        <div className="ins-metric">
          <div className="label">Partial</div>
          <div className="value">{count(all, 'Partial')}</div>
          <div className="foot">covered with stated limits</div>
        </div>
        <div className="ins-metric">
          <div className="label">Not implemented</div>
          <div className="value">{count(all, 'Not implemented')}</div>
          <div className="foot">named, not hidden</div>
        </div>
        <div className="ins-metric">
          <div className="label">Objectives</div>
          <div className="value">{count(objectives, 'Working')} / 7</div>
          <div className="foot">fully working</div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        <Panel title="Seven official objectives">
          <Table rows={objectives} />
        </Panel>
        <Panel title="Challenge statement clauses">
          <Table rows={challenge} />
        </Panel>
        <Panel title="CERT-In smart-city areas named in the statement">
          <Table rows={certIn} />
        </Panel>
      </div>
      <p className="ins-fine">
        Statuses are reviewed text, not computed. They match docs/VERIFICATION.md and the limits
        stated on each page.
      </p>
    </>
  )
}
