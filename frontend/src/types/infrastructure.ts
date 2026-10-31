export type AssetStatus = "operational" | "degraded" | "offline" | "maintenance";

export type CriticalityLevel = "critical" | "high" | "medium" | "low";

export type InfrastructureSector = "power" | "water" | "healthcare" | "industrial" | "iot";

export type DependencyType = "operational" | "network";

export interface InfrastructureAsset {
  id: string;
  name: string;
  assetType: string;
  sector: InfrastructureSector;
  site: string;
  description: string;

  status: AssetStatus;
  criticalityScore: number;
  criticalityLevel: CriticalityLevel;

  operationalImportance: number;      // 0 - 100
  safetyImpact: number;               // 0 - 100
  serviceDisruptionImpact: number;    // 0 - 100
  redundancyScore: number;            // 0 - 100
  dependencyCentrality?: number;       // 0 - 100 (computed)

  protocols?: string[];
  ipAddress?: string;

  dependencies: string[];             // IDs of assets this asset relies on (Upstream)
  dependents: string[];               // IDs of assets that rely on this asset (Downstream)

  lastUpdated: string;

  // Digital twin visual mapping
  substationComponentId?: string;     // Links to Anatomy isometric component ID
  smartCityComponentId?: string;      // Links to Anatomy Smart City isometric component ID
  hasIndependentBackup?: boolean;      // True if asset has backup generator/UPS mitigation
  backupSourceAssetId?: string;

  whyImportant?: string;              // Plain language explanation
  mitigationPlan?: string;

  telemetry?: {
    metricName: string;
    value: number | string;
    unit: string;
    thresholdWarning?: number;
    thresholdCritical?: number;
  };
}

export interface DependencyEdge {
  id: string;
  source: string;                     // Provider asset ID
  target: string;                     // Dependent asset ID
  type: DependencyType;               // "operational" (Power/Water/Cooling feed) vs "network" (SCADA/DNP3/Modbus)
  label: string;
  capacity?: string;
  protocol?: string;
}

export interface CriticalityWeights {
  operationalImportance: number;
  safetyImpact: number;
  serviceDisruptionImpact: number;
  dependencyCentrality: number;
  lackOfRedundancy: number;
}

export interface CriticalityBreakdown {
  operationalImportanceContrib: number;
  safetyImpactContrib: number;
  serviceDisruptionContrib: number;
  dependencyCentralityContrib: number;
  redundancyPenaltyContrib: number;
  centralityValue: number;
  rawScore: number;
}

export interface SimulationResult {
  rootAssetId: string;
  failedAssetIds: string[];
  directlyAffectedIds: string[];
  indirectlyAffectedIds: string[];
  mitigatedAssetIds: string[];
  disruptedServices: string[];
  executiveSummary: string;
  propagationPath: {
    from: string;
    to: string;
    hop: number;
  }[];
}
