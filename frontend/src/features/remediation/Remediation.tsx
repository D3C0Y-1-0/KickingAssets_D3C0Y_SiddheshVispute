import { ArrowUpRight, CheckCheck, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeading, Panel, PreviewNotice } from '../../components/ui'

export default function Remediation() {
  return (
    <>
      <PageHeading
        title="Remediation plan"
        description="Make the next action count. Prioritize reduction, effort and operational feasibility."
        actions={
          <button
            className="button primary"
            disabled
            title="Requires the future optimization engine"
          >
            <ListChecks size={16} />
            Optimizer unavailable
          </button>
        }
      />
      <PreviewNotice>
        No optimized plan has been generated. Marginal reductions will remain unavailable until risk
        and what-if calculations exist.
      </PreviewNotice>
      <div className="metric-grid three-metrics">
        <section className="metric-card">
          <div className="metric-label">
            Prioritized actions
            <ListChecks size={16} />
          </div>
          <div className="metric-value">—</div>
          <div className="metric-foot">Optimizer not implemented</div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Projected marginal reduction
            <CheckCheck size={16} />
          </div>
          <div className="metric-value">—</div>
          <div className="metric-foot">Requires sequential recalculation</div>
        </section>
        <section className="metric-card">
          <div className="metric-label">Estimated effort</div>
          <div className="metric-value">—</div>
          <div className="metric-foot">No action costs have been assessed</div>
        </section>
      </div>
      <Panel
        title="Prioritized preventive actions"
        aside={<span className="badge neutral">AWAITING OPTIMIZER</span>}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PRIORITY / ACTION</th>
                <th>TARGET ASSET</th>
                <th>JUSTIFICATION</th>
                <th>EFFORT</th>
                <th>DISRUPTION</th>
                <th>MARGINAL REDUCTION</th>
              </tr>
            </thead>
          </table>
        </div>
        <EmptyState title="A plan starts with evidence">
          Connect vulnerability intelligence and a calculated assessment, then compare preventive
          actions under operational constraints.
        </EmptyState>
        <div className="centered-action">
          <Link to="/what-if" className="button secondary">
            Explore the What-If lab
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </Panel>
      <div className="two-column spaced-panel">
        <Panel title="Action details">
          <EmptyState compact title="No action selected">
            A selected action will show prerequisites, target configuration, effort provenance,
            security justification and rollback considerations.
          </EmptyState>
        </Panel>
        <Panel title="Optimization principles">
          <ol className="principle-list">
            <li>Start from a versioned, calculated baseline.</li>
            <li>Recompute marginal risk reduction after each staged action.</li>
            <li>Respect maintenance windows, effort budgets and service constraints.</li>
            <li>Keep projected outcomes distinct from verified improvements.</li>
          </ol>
        </Panel>
      </div>
    </>
  )
}
