# GridSentinel product specification

Version: 0.1 · Phase 1 · 31 October 2026

## Purpose and authority

GridSentinel supports critical infrastructure operators moving from reactive vulnerability management to proactive cyber-risk assessment. Its positioning is **“See the blast radius before the incident.”** The city and all infrastructure in this prototype are simulated.

The seven objectives below are the **official PS03 KEY OBJECTIVES supplied verbatim by the project owner** during Phase 1. They are authoritative for this repository. Their inclusion is not a claim that all objectives have been implemented. The owner's approved master implementation prompt sets the architecture and phase boundaries.

## Official objectives and requirement mapping

### 1. Infrastructure Asset Profiling

**Original:** “Represent infrastructure assets such as power-grid components, water-treatment systems, hospital networks, IoT devices, and industrial control systems, including their importance and dependencies.”

**GridSentinel modules:** scenario inventory, Asset & Risk Register, Infrastructure Map, SQLite repository, `InfrastructureAsset`, both edge schemas and `EssentialService`.

**Phase 1:** working fictional asset inventory, criticality, exposure, products, versions, security assumptions and dependency inspection. **Later:** richer profiles and validated real reference associations. This is a working simulated foundation; coverage of arbitrary real infrastructure is not claimed.

### 2. Vulnerability Assessment

**Original:** “Analyse simulated asset inventories, known vulnerability information, software versions, configuration weaknesses, and exposure indicators to identify potential security gaps.”

**GridSentinel modules:** reference ingestion, applicability service, observation records, vulnerability findings, asset detail and Risk Intelligence.

**Phase 1:** configuration fields, vulnerability/reference contracts and honest empty record areas. **Later:** real NVD/CVSS/EPSS/KEV ingestion, applicability review, configuration findings and evidence lineage. **Not implemented as an assessment engine.**

### 3. AI-Based Risk Prediction

**Original:** “Use machine learning or risk-modelling techniques to estimate the likelihood and potential impact of cyber incidents based on historical or simulated data.”

**GridSentinel modules:** future XGBoost/scikit-learn CVE prioritizer, transparent asset risk scorer and conditional service impact engine.

**Phase 1:** versioned nullable result contracts and reserved engine/ML boundaries. **Later:** temporally validated prioritization and explained relative risk modelling. Probability outputs require explicit calibration and evaluation; a relative 0–100 index is not an incident probability. **No prediction model or risk calculation exists in Phase 1.**

### 4. Risk Prioritization

**Original:** “Rank assets according to vulnerability severity, exposure, operational importance, and potential consequences of compromise.”

**GridSentinel modules:** asset risk scorer, Risk Intelligence rankings, overview priority panel and eventually remediation optimization.

**Phase 1:** preview layouts and seven isolated illustrative frontend labels. **Later:** evidence-backed ordering with versioned contributions, applicability and impact. **No calculated prioritization is claimed.**

### 5. Dependency and Impact Analysis

**Original:** “Identify how a compromised component could affect connected assets or essential services.”

**GridSentinel modules:** independent cyber reachability and operational dependency graphs, future effect-specific service-impact simulation, service requirement groups and backups.

**Phase 1:** both graphs are real, interactive views of stored fictional data; direction, protocols, dependencies and assumptions are inspectable. **Later:** conditional impact by compromise effect, k-of-n redundancy, backup delay/duration and explicit initiating assumptions. **Reachability and dependency modelling are implemented; consequence computation is not.**

### 6. Predictive Risk Dashboard

**Original:** “Visualise risk scores, vulnerable assets, changing threat levels, and the components requiring immediate attention.”

**GridSentinel modules:** Command Overview, Risk Intelligence, Asset & Risk Register, chart components and versioned snapshot comparison.

**Phase 1:** seven-route dashboard foundation, API inventory, source labels, a sample risk chart and explicit unavailable states. **Later:** calculated scores, actual vulnerability findings and comparable assessment history. **The UI shell does not satisfy predictive functionality by itself.**

### 7. Preventive Recommendations

**Original:** “Suggest actions such as patch prioritization, network segmentation, access-control improvements, enhanced monitoring, and incident-response planning.”

**GridSentinel modules:** future mitigation catalog/recommendation service, What-If Lab, remediation optimizer and verification records.

**Phase 1:** a configuration-based catalog for temporary hypothetical staging and a remediation layout; no action is executed and no reduction is calculated. **Later:** evidence-backed recommendations and action costs, what-if comparison and sequential marginal optimization subject to operational constraints. Monitoring and incident-response planning may be recommendations; a live monitoring system or autonomous response is outside this prototype.

## Original Expected Solution

The owner supplied these statements as the official expected solution:

- “The proposed system should help infrastructure operators transition from reactive vulnerability management to proactive cyber-risk assessment.”
- “A working prototype could include a simulated infrastructure map, an asset inventory, vulnerability information, AI-generated risk scores, and recommendations for reducing risk.”
- “The solution should explain why an asset has been classified as high risk and how addressing a particular vulnerability could reduce the overall risk to the infrastructure.”

The simulated map and inventory are working in Phase 1. Real vulnerability information, generated scores, explanations and recalculated reductions require the later implementation gates below.

## Final product vision

One local command center will connect evidence-backed asset profiles to CVE priority signals, transparent susceptibility and consequence factors, conditional essential-service impact, preventive recommendations and what-if results. The user will be able to inspect every source, assumption and version, then compare actions by marginal reduction, effort and disruption.

Cyber access paths and operational-service relationships stay separate throughout. A compromised asset can have loss of control, loss of visibility, data-integrity or unavailability effects; those effects need different operational assumptions. Redundancy and finite backups must be evaluated instead of treating every graph descendant as failed.

Current assessments, projected hypothetical results and independently verified changes remain distinct. Deterministic snapshots support repeatable demonstrations and comparisons. The backend will serve the compiled React application from the same local process for the offline demonstration.

## Phase 1 versus subsequent innovations

Phase 1 delivers the product shell, design tokens, original isometric technical figure, deterministic dataset, schemas, persistence, working inventory APIs, graph interactions, typed integration, tests and engineering documentation. Read-only data and local staging are real functionality.

Subsequent innovations include real feed ingestion and CVE applicability; validated ML prioritization; explainable relative risk; effect-aware cyber/operational analysis; conditional service disruption; versioned what-if recalculation; and a lightweight greedy optimizer that recalculates each marginal gain. See IMPLEMENTATION_PLAN.md for order and gates. No microservices or multi-agent AI orchestration are planned.

## Explicit limitations

- Fictional products and version numbers do not establish real CVE matches.
- Scenario controls are assumed, not collected by scans or verified by an operator.
- There is one unassessed baseline snapshot; no risk trend exists yet.
- Preview scores are design fixtures, not predictions or assessment evidence.
- Paths do not prove compromise; operational dependencies do not imply cyber access.
- No incident probability, time-to-incident, live advisory stream, infrastructure mutation or autonomous remediation is claimed.
- The local prototype binds to loopback and has no authentication layer; networked deployment is outside Phase 1.
