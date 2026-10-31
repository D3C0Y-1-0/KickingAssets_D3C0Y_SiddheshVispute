import { useState } from "react";
import {
  Building2,
  Droplets,
  HeartPulse,
  Train,
  Zap,
  ExternalLink,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeading } from "../../components/ui";
import { RunSimulationButton } from "../../components/Simulation";
import { useTwinRisk } from "../../hooks/twinRisk";

// 5 Dedicated Anatomy Diagram Viewers
import { SmartCityViewer } from "../../components/smartcity/SmartCityViewer";
import { SubstationViewer } from "../../components/anatomy/SubstationViewer";
import { WaterPlantViewer } from "../../components/waterplant/WaterPlantViewer";
import { TransitViewer } from "../../components/transit/TransitViewer";
import { HospitalViewer } from "../../components/hospital/HospitalViewer";

import { INITIAL_DEMO_ASSETS } from "../../data/demoAssets";
import { InfrastructureAsset } from "../../types/infrastructure";

type TwinMode = "smartcity" | "power" | "water" | "transit" | "hospital";

export default function DigitalTwins() {
  const [activeTab, setActiveTab] = useState<TwinMode>("smartcity");
  const [selectedAsset, setSelectedAsset] = useState<InfrastructureAsset | null>(
    INITIAL_DEMO_ASSETS[0]
  );

  const assets = INITIAL_DEMO_ASSETS;
  const { run, risk } = useTwinRisk();
  const prefix: Record<TwinMode, string | null> = {
    smartcity: null,
    power: "PWR",
    water: "WTR",
    transit: "",
    hospital: "HLT",
  };
  const sectorAssets = (run?.assets ?? [])
    .filter((a) => prefix[activeTab] === null || (prefix[activeTab] && a.asset_id.startsWith(prefix[activeTab] as string)))
    .filter((a) => a.risk.category === "critical" || a.risk.category === "high");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeading
        eyebrow="AURORA CITY / PHYSICAL TWINS"
        title="Infrastructure Digital Twins"
        description="High-fidelity interactive isometric illustrations created with Anatomy. Explore physical engineering components, operational telemetry, multi-turn utility conduit mesh, and sector dependencies."
      />

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-xl bg-[#111319] border border-[#202634] text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            data-twin-tab="smartcity"
            onClick={() => setActiveTab("smartcity")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
              activeTab === "smartcity"
                ? "bg-[#ccff00] text-black font-extrabold shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#181c26]"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Smart City (Integrated Twin)</span>
          </button>

          <button
            data-twin-tab="power"
            onClick={() => setActiveTab("power")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
              activeTab === "power"
                ? "bg-[#ccff00] text-black font-extrabold shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#181c26]"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Power Grid & Substation (33/11kV)</span>
          </button>

          <button
            data-twin-tab="water"
            onClick={() => setActiveTab("water")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
              activeTab === "water"
                ? "bg-[#ccff00] text-black font-extrabold shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#181c26]"
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>Water Treatment & Reservoir</span>
          </button>

          <button
            data-twin-tab="transit"
            onClick={() => setActiveTab("transit")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
              activeTab === "transit"
                ? "bg-[#ccff00] text-black font-extrabold shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#181c26]"
            }`}
          >
            <Train className="w-4 h-4" />
            <span>Transit & Rail Transportation</span>
          </button>

          <button
            data-twin-tab="hospital"
            onClick={() => setActiveTab("hospital")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
              activeTab === "hospital"
                ? "bg-[#ccff00] text-black font-extrabold shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#181c26]"
            }`}
          >
            <HeartPulse className="w-4 h-4" />
            <span>Trauma Hospital & Healthcare</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#182306] rounded-lg border border-[#4d6313] text-[11px] font-mono text-[#ccff00]">
          <span className="flex h-2 w-2 rounded-full bg-[#ccff00] animate-pulse" />
          <span className="font-bold">ANATOMY SVG ENGINE · 100% OPERATIONAL</span>
        </div>
      </div>

      {/* Live risk from the latest simulation run */}
      <div className="p-3.5 rounded-xl bg-[#111319] border border-[#202634] text-xs twin-risk-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-slate-100">
              {run ? `Simulation ${run.id} · as of ${run.as_of}` : "No simulation has run yet"}
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {run
                ? "Blinking radar marks twin parts whose attached controller, relay or gateway scores high or critical in the ML risk index. Which asset sits behind which part is a scenario assumption; the KPI cards below remain illustrative demo figures."
                : "Run the simulation to score every asset with the ML model and light up the twin."}
            </p>
          </div>
          <RunSimulationButton variant={run ? "secondary" : "primary"} label={run ? "Re-run simulation" : "Run simulation"} />
        </div>
        {run && (
          <div className="twin-risk-list">
            {activeTab === "transit" ? (
              <span className="text-slate-400">Transit is not part of the scored scenario (power, water, healthcare only).</span>
            ) : sectorAssets.length === 0 ? (
              <span className="text-slate-400">No high or critical assets in this view.</span>
            ) : (
              sectorAssets.map((a) => (
                <span key={a.asset_id} className={`twin-risk-chip ${a.risk.category}`}>
                  <span className={`relative inline-block w-3 h-3`}>
                    <span className={`twin-radar ${a.risk.category}`} aria-hidden>
                      <i />
                      <b />
                    </span>
                  </span>
                  <span className="font-mono">{a.asset_id}</span>
                  <span>{a.name}</span>
                  <strong className="font-mono">{a.risk.score?.toFixed(1)}</strong>
                </span>
              ))
            )}
          </div>
        )}
      </div>

      {/* Sector KPI Summary Cards Styled in Reference Electric Lime Theme */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        {/* KPI 1 — Electric Lime Hero Card */}
        <div className="p-3.5 rounded-xl bg-[#ccff00] text-black border border-[#d9ff33]/50 shadow-md">
          <div className="flex items-center justify-between text-black font-semibold text-[11px]">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-black" />
              <span>Precinct Twin</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-black font-mono font-bold text-[10px]">
              +4.2%
            </span>
          </div>
          <div className="text-2xl font-black text-black tracking-tight mt-1">6 Islands</div>
          <div className="text-[11px] text-black/80 font-semibold mt-0.5">Routed Conduit Corridors</div>
        </div>

        {/* KPI 2 — Electric Lime Hero Card */}
        <div className="p-3.5 rounded-xl bg-[#ccff00] text-black border border-[#d9ff33]/50 shadow-md">
          <div className="flex items-center justify-between text-black font-semibold text-[11px]">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-black" />
              <span>Power Substation</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-black font-mono font-bold text-[10px]">
              33/11kV
            </span>
          </div>
          <div className="text-2xl font-black text-black tracking-tight mt-1">25 MVA</div>
          <div className="text-[11px] text-black/80 font-semibold mt-0.5">Top Oil: 61.4°C Nominal</div>
        </div>

        {/* KPI 3 — Electric Lime Hero Card */}
        <div className="p-3.5 rounded-xl bg-[#ccff00] text-black border border-[#d9ff33]/50 shadow-md">
          <div className="flex items-center justify-between text-black font-semibold text-[11px]">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-black" />
              <span>Purification Works</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-black font-mono font-bold text-[10px]">
              92.4%
            </span>
          </div>
          <div className="text-2xl font-black text-black tracking-tight mt-1">42.5K m³</div>
          <div className="text-[11px] text-black/80 font-semibold mt-0.5">18.5MG Storage Res.</div>
        </div>

        {/* KPI 4 — Dark Tech Card with Lime Accents */}
        <div className="p-3.5 rounded-xl bg-[#111319] border border-[#202634] text-slate-100 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <Train className="w-4 h-4 text-[#ccff00]" />
              <span>Transit Rail</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#182306] text-[#ccff00] font-mono font-bold text-[10px]">
              SIL-4
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight mt-1">90s</div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">Headway · CBTC Active</div>
        </div>

        {/* KPI 5 — Dark Tech Card with Lime Accents */}
        <div className="p-3.5 rounded-xl bg-[#111319] border border-[#202634] text-slate-100 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-[#ccff00]" />
              <span>Trauma Center</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#182306] text-[#ccff00] font-mono font-bold text-[10px]">
              VFR
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight mt-1">100%</div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">ICU Ready · Helipad On</div>
        </div>
      </div>

      {/* Active Digital Twin Diagram Stage — Dark Seamless Container */}
      <div className="w-full min-h-[680px] rounded-xl overflow-hidden bg-[#08090d] border border-[#202634] shadow-2xl relative">
        {activeTab === "smartcity" && (
          <SmartCityViewer
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            risk={risk}
          />
        )}

        {activeTab === "power" && (
          <SubstationViewer
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            risk={risk}
          />
        )}

        {activeTab === "water" && <WaterPlantViewer risk={risk} />}

        {activeTab === "transit" && <TransitViewer />}

        {activeTab === "hospital" && <HospitalViewer risk={risk} />}
      </div>

      {/* Engineering Notes & Cross-Reference Card */}
      <div className="p-4 rounded-xl bg-[#111319] border border-[#202634] text-xs text-slate-300 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#182306] border border-[#4d6313] text-[#ccff00]">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-100">
              Deterministic Critical Infrastructure Modeling
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Each physical illustration adheres to official Anatomy principles: isometric volume, painter&apos;s depth ordering, zero floating lines, and orthogonal 90° utility corridor routing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/assets"
            className="px-3.5 py-2 rounded-lg bg-[#161922] hover:bg-[#1f2430] text-slate-200 font-medium flex items-center gap-1.5 border border-[#202634] transition"
          >
            <span>View Asset Register</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/infrastructure"
            className="px-4 py-2 rounded-lg bg-[#ccff00] hover:bg-[#d9ff33] text-black font-extrabold flex items-center gap-1.5 transition shadow-sm"
          >
            <span>Infrastructure Map</span>
            <ExternalLink className="w-3.5 h-3.5 text-black" />
          </Link>
        </div>
      </div>
    </div>
  );
}
