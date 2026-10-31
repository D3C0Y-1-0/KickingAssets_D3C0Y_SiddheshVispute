"use client";

import { useState, useMemo, useEffect } from "react";
import { Plate } from "../iso/react/draw";
import { SmartCityArt } from "./art";
import { WIDTH, HEIGHT, at } from "./view";
import { InfrastructureAsset } from "../../types/infrastructure";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Layers,
  Activity,
  Eye,
  Zap,
  Radio,
  Wifi,
  Train,
  Building,
} from "lucide-react";
import { RadarPing, RiskLine } from "../TwinRadar";
import type { TwinRisk } from "../../hooks/twinRisk";
import "./smartcity.css";
import { useStageView } from "../twin/useStageView";
import { FlowOverlay, type LinkMode } from "../twin/FlowOverlay";
import { TwinInspector } from "../twin/TwinInspector";
import { useTwinNav } from "../twin/TwinNav";
import { useLatestRun } from "../../hooks/queries";
import { usePartLinks } from "../../hooks/twinConnections";

interface SmartCityViewerProps {
  assets: InfrastructureAsset[];
  selectedAsset: InfrastructureAsset | null;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  isSimulationActive?: boolean;
  failedAssetIds?: string[];
  affectedAssetIds?: string[];
  risk?: Record<string, TwinRisk>;
}

export function SmartCityViewer({
  assets,
  selectedAsset,
  onSelectAsset,
  isSimulationActive = false,
  failedAssetIds = [],
  affectedAssetIds = [],
  risk = {},
}: SmartCityViewerProps) {
  // Shared pan / zoom / fullscreen (drag, wheel, pinch, keyboard)
  const stage = useStageView({ initialZoom: 0.8, content: { width: WIDTH, height: HEIGHT } });
  const { isFullScreen, toggleFullScreen } = stage;
  const handleZoomIn = stage.zoomIn;
  const handleZoomOut = stage.zoomOut;
  const handleResetView = stage.reset;
  const containerRef = stage.frameRef;
  const { requestedPart } = useTwinNav();
  const [linkMode, setLinkMode] = useState<LinkMode>("operational");
  const partLinks = usePartLinks();
  const run = useLatestRun().data;
  const scored = useMemo(() => new Map((run?.assets ?? []).map((a) => [a.asset_id, a])), [run]);

  // Layer toggles
  const [showMicrogrid, setShowMicrogrid] = useState<boolean>(true);
  const [showFiberMesh, setShowFiberMesh] = useState<boolean>(true);
  const [showTransitFlow, setShowTransitFlow] = useState<boolean>(true);
  const [showBridges, setShowBridges] = useState<boolean>(true);
  const [showWirelessWaves, setShowWirelessWaves] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);

  // Hover state for interactive readout
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);


  // Map of smartCityComponentId -> InfrastructureAsset
  const componentToAssetMap = useMemo(() => {
    const map = new Map<string, InfrastructureAsset>();
    assets.forEach((asset) => {
      if (asset.smartCityComponentId) {
        map.set(asset.smartCityComponentId, asset);
      }
    });
    return map;
  }, [assets]);

  // Map of componentId -> status
  const statusMap = useMemo(() => {
    const map: Record<string, "operational" | "degraded" | "offline" | "maintenance"> = {};

    assets.forEach((asset) => {
      if (!asset.smartCityComponentId) return;

      if (isSimulationActive) {
        if (failedAssetIds.includes(asset.id)) {
          map[asset.smartCityComponentId] = "offline";
        } else if (affectedAssetIds.includes(asset.id)) {
          map[asset.smartCityComponentId] = "degraded";
        } else {
          map[asset.smartCityComponentId] = "operational";
        }
      } else {
        map[asset.smartCityComponentId] = asset.status;
      }
    });

    return map;
  }, [assets, isSimulationActive, failedAssetIds, affectedAssetIds]);

  // Active selected component ID
  const selectedComponentId = selectedAsset?.smartCityComponentId;

  // Hotspots projected 2D coordinates
  const hotspots = useMemo(() => {
    return [
      {
        id: "city-substation",
        label: "Bulk Power & Substation Campus",
        sub: "33/11kV Main Power Transformer",
        coord: at([-415, -42, 45]),
        assetId: "SUB-TR-01",
      },
      {
        id: "city-hospital",
        label: "Regional Trauma Hospital",
        sub: "Tertiary Healthcare Campus & Helipad",
        coord: at([180, 165, 76]),
        assetId: "HLT-HOS-01",
      },
      {
        id: "city-ioc",
        label: "IOC Command Skyscraper",
        sub: "Urban AI Operations & Helipad",
        coord: at([177, -237, 138]),
        assetId: "CITY-IOC-01",
      },
      {
        id: "city-edge-dc",
        label: "5G Edge Compute & Mast",
        sub: "Carrier-Grade Datacenter Compound",
        coord: at([-220, -250, 150]),
        assetId: "CITY-EDGE-01",
      },
      {
        id: "city-water",
        label: "Water Purification Works",
        sub: "Clarifiers & Filtration Station",
        coord: at([355, -45, 25]),
        assetId: "WTR-PLT-01",
      },
      {
        id: "city-reservoir",
        label: "Elevated Water Reservoir",
        sub: "Gravity Pressurization Drum",
        coord: at([385, -25, 72]),
        assetId: "WTR-TNK-01",
      },
      {
        id: "city-transit-rail",
        label: "Sky-Train Rail Viaduct",
        sub: "Inter-Island Driverless Light Rail",
        coord: at([-50, 35, 62]),
        assetId: "CITY-RAIL-01",
      },
      {
        id: "city-ev-hub",
        label: "Smart EV Transit Depot",
        sub: "Autonomous Bus & Fast Charging",
        coord: at([-290, 165, 20]),
        assetId: "CITY-EV-01",
      },
      {
        id: "city-bess",
        label: "Municipal BESS Storage",
        sub: "10MW / 40MWh Microgrid Bank",
        coord: at([-360, -60, 30]),
        assetId: "CITY-BESS-01",
      },
      {
        id: "city-solar",
        label: "Solar PV Canopy",
        sub: "2.5MWp Photovoltaic Generation",
        coord: at([-420, 20, 30]),
        assetId: "CITY-SOLAR-01",
      },
      {
        id: "city-utility-trench",
        label: "Inter-Island Sky-Bridges",
        sub: "Conduit Trusses & Lifeline Spans",
        coord: at([-90, -270, 14]),
        assetId: "CITY-UTIL-01",
      },
    ];
  }, []);

  // Component click
  const handleSelectComponent = (componentId: string) => {
    const matchedAsset = componentToAssetMap.get(componentId);
    if (matchedAsset) {
      onSelectAsset(matchedAsset);
    }
  };

  const readoutText = selectedAsset
    ? `${selectedAsset.id} · ${selectedAsset.name.toUpperCase()} · [${selectedAsset.status.toUpperCase()}] · CRITICALITY: ${selectedAsset.criticalityScore}/100`
    : "METROPOLITAN DIGITAL TWIN · SELECT ANY FACILITY OR SUBSYSTEM TO INSPECT";

  const { centerOn } = stage;
  useEffect(() => {
    const h = requestedPart ? hotspots.find((x) => x.id === requestedPart) : undefined;
    if (h) {
      handleSelectComponent(h.id);
      centerOn(h.coord[0], h.coord[1], WIDTH, HEIGHT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPart]);

  return (
    <div
      ref={containerRef}
      className={`select-none flex flex-col bg-[#08090d] overflow-hidden transition-all ${
        isFullScreen
          ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-2xl"
          : "relative flex flex-col w-full h-full border border-[#202634] rounded-xl shadow-2xl"
      }`}
    >
      {/* Top Header / Viewport HUD */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111319]/95 border-b border-[#202634] backdrop-blur z-20 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#182306] border border-[#4d6313] text-[#ccff00]">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-white uppercase">
                Metropolitan Smart City Architecture
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#182306] text-[#ccff00] border border-[#4d6313]">
                PRECINCT 7 DIGITAL TWIN
              </span>
              {isFullScreen && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ccff00] text-black">
                  FULL SCREEN ACTIVE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Real-time City Telemetry Strip */}
        <div className="hidden min-[1800px]:flex items-center gap-4 text-xs font-mono bg-[#161922] px-3 py-1.5 rounded-lg border border-[#202634] shadow-xs">
          <span className="text-[#d8b16c]">Design ref., not live</span>
          <div className="w-px h-3 bg-[#202634]" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#ccff00]" />
            <span className="text-slate-400">Grid Load:</span>
            <span className="text-slate-100 font-semibold">14.8 MW</span>
          </div>
          <div className="w-px h-3 bg-[#202634]" />
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">5G Latency:</span>
            <span className="text-slate-100 font-semibold">3.4 ms</span>
          </div>
          <div className="w-px h-3 bg-[#202634]" />
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#ccff00]" />
            <span className="text-slate-400">Air Quality:</span>
            <span className="text-[#ccff00] font-semibold">36 AQI</span>
          </div>
          <div className="w-px h-3 bg-[#202634]" />
          <div className="flex items-center gap-1.5">
            <Train className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Transit Headway:</span>
            <span className="text-slate-100 font-semibold">90s</span>
          </div>
        </div>


        <div className="ts-group" role="group" aria-label="Connection overlay">
          {(["operational", "cyber", "off"] as const).map((m) => (
            <button
              key={m}
              className="ts-btn"
              aria-pressed={linkMode === m}
              onClick={() => setLinkMode(m)}
              title={
                m === "operational"
                  ? "Operational dependencies, provider to dependent"
                  : m === "cyber"
                    ? "Cyber reachability, permitted access paths"
                    : "Hide connections"
              }
            >
              {m === "off" ? "Links off" : m === "operational" ? "Operational" : "Cyber"}
            </button>
          ))}
        </div>
        {/* View Controls */}
        <div className="flex items-center gap-1.5 bg-[#161922] p-1 rounded-lg border border-[#202634] shadow-xs">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] transition"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-[#202634] my-auto" />
          <button
            onClick={toggleFullScreen}
            className={`p-1.5 rounded transition ${
              isFullScreen
                ? "bg-[#ccff00] text-black font-extrabold shadow-sm"
                : "hover:bg-[#202636] text-slate-400 hover:text-[#ccff00]"
            }`}
            title={isFullScreen ? "Exit Full Screen (Esc)" : "Full Screen (Expand View)"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4 text-black" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Layer Toggles Floating Filter Bar */}
      <div className="relative z-20 mx-3 mt-2 self-start flex flex-wrap items-center gap-1.5 bg-[#111319]/95 backdrop-blur-md p-1.5 rounded-lg border border-[#202634] text-[11px] font-medium shadow-xl">
        <span className="text-[10px] font-mono uppercase text-slate-400 px-1.5 flex items-center gap-1">
          <Layers className="w-3 h-3 text-[#ccff00]" />
          Overlays:
        </span>
        <button
          onClick={() => setShowFiberMesh(!showFiberMesh)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 border ${
            showFiberMesh
              ? "bg-[#182306] text-[#ccff00] border-[#4d6313] font-semibold"
              : "bg-[#161922] text-slate-400 hover:text-white border-[#202634]"
          }`}
        >
          <Wifi className="w-3 h-3" />
          5G & Fiber Backbone
        </button>
        <button
          onClick={() => setShowMicrogrid(!showMicrogrid)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 border ${
            showMicrogrid
              ? "bg-[#182306] text-[#ccff00] border-[#4d6313] font-semibold"
              : "bg-[#161922] text-slate-400 hover:text-white border-[#202634]"
          }`}
        >
          <Zap className="w-3 h-3" />
          Microgrid & Solar
        </button>
        <button
          onClick={() => setShowTransitFlow(!showTransitFlow)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 border ${
            showTransitFlow
              ? "bg-[#182306] text-[#ccff00] border-[#4d6313] font-semibold"
              : "bg-[#161922] text-slate-400 hover:text-white border-[#202634]"
          }`}
        >
          <Train className="w-3 h-3" />
          Sky-Train Rail
        </button>
        <button
          onClick={() => setShowBridges(!showBridges)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 border ${
            showBridges
              ? "bg-[#182306] text-[#ccff00] border-[#4d6313] font-semibold"
              : "bg-[#161922] text-slate-400 hover:text-white border-[#202634]"
          }`}
        >
          Inter-Island Bridges
        </button>
        <button
          onClick={() => setShowWirelessWaves(!showWirelessWaves)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 border ${
            showWirelessWaves
              ? "bg-[#182306] text-[#ccff00] border-[#4d6313] font-semibold"
              : "bg-[#161922] text-slate-400 hover:text-white border-[#202634]"
          }`}
        >
          <Radio className="w-3 h-3" />
          5G Radios
        </button>
        <button
          onClick={() => setShowHotspots(!showHotspots)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 border ${
            showHotspots
              ? "bg-[#ccff00] text-black border-[#ccff00] font-extrabold"
              : "bg-[#161922] text-slate-400 hover:text-white border-[#202634]"
          }`}
        >
          <Eye className="w-3 h-3" />
          Hotspot Pins
        </button>
      </div>

      {/* Main Interactive Canvas */}
      <div className="ts-body">
      <div
        ref={stage.stageRef}
        {...stage.stageProps}
        aria-label="Smart city diagram. Drag to pan, Ctrl or Cmd plus scroll to zoom, plus and minus keys to zoom."
        className={`relative min-w-0 overflow-hidden flex items-center justify-center outline-none ${stage.dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <Plate
          fig="FIG 02"
          title="DISTRIBUTED SMART CITY ARCHITECTURE (MODULAR ISLAND BASES)"
          hint="DRAG TO PAN · CTRL + WHEEL TO ZOOM · CLICK ANY ISLAND CAMPUS TO INSPECT"
          readout={readoutText}
          keys={[
            { mark: "lit", label: "Selected Active Campus" },
            { mark: "raised", label: "Engineered Modular Island Bases" },
            { mark: "edge", label: "Inter-Island Sky-Bridges & Rail Viaduct" },
            { mark: "dotted", label: "Microgrid & Wireless Mesh" },
          ]}
          caption="Distributed Smart City Architecture digital twin showing distinct modular infrastructure island platforms: Bulk Electricity Power Plant & Substation Campus, Regional Trauma Medical Campus, Urban IOC Command Skyscraper & Civic Plaza, 5G Telecom & Edge Compute Compound, Municipal Water Purification Works, and Smart Transit Hub, interconnected by elevated Sky-Train rail viaducts and structural sky-bridges."
        >
          <div
            style={stage.transformStyle}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Anatomy Isometric SVG Assembly */}
            <div className="relative" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full h-full iso-svg block"
                role="img"
                aria-label="Smart City Architecture Digital Twin Isometric Diagram"
              >
                <SmartCityArt
                  selectedComponentId={selectedComponentId}
                  statusMap={statusMap}
                  showMicrogrid={showMicrogrid}
                  showFiberMesh={showFiberMesh}
                  showTransitFlow={showTransitFlow}
                  showBridges={showBridges}
                  showWirelessWaves={showWirelessWaves}
                  onSelectComponent={handleSelectComponent}
                />
              </svg>

              <FlowOverlay
                width={WIDTH}
                height={HEIGHT}
                points={Object.fromEntries(hotspots.map((h) => [h.id, h.coord])) as Record<string, [number, number]>}
                links={partLinks}
                mode={linkMode}
                focusId={hoveredComponentId ?? selectedComponentId ?? null}
              />

              {/* Interactive Projected Hotspots Overlay */}
              {showHotspots &&
                hotspots.map((h) => {
                  const isSelected = selectedComponentId === h.id;
                  const status = statusMap[h.id] || "operational";

                  let statusColor = "bg-cyan-500 border-cyan-300 text-cyan-300";
                  if (status === "offline") statusColor = "bg-red-500 border-red-300 text-red-300 animate-pulse";
                  else if (status === "degraded") statusColor = "bg-amber-500 border-amber-300 text-amber-300 animate-pulse";

                  return (
                    <div
                      key={h.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectComponent(h.id);
                      }}
                      onMouseEnter={() => setHoveredComponentId(h.id)}
                      onMouseLeave={() => setHoveredComponentId(null)}
                      style={{
                        position: "absolute",
                        left: `${h.coord[0]}px`,
                        top: `${h.coord[1]}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                      className="group cursor-pointer z-30" role="button" tabIndex={0} aria-label={h.label} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectComponent(h.id); } }} onFocus={() => setHoveredComponentId(h.id)} onBlur={() => setHoveredComponentId(null)}
                    >
                      <div className="relative flex items-center justify-center">
                        <RadarPing risk={risk[h.id]} />
                        {/* Pulsing ring for selected or alert */}
                        {isSelected && (
                          <span className="absolute w-7 h-7 rounded-full bg-cyan-400/30 animate-ping pointer-events-none" />
                        )}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 transition shadow-lg ${
                            isSelected
                              ? "bg-cyan-400 border-white scale-125 ring-2 ring-cyan-500/50"
                              : statusColor
                          }`}
                        />
                      </div>

                      {/* Hotspot Floating Tooltip */}
                      <div
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-lg bg-[#111319]/98 border border-[#283244] shadow-2xl backdrop-blur-md pointer-events-none transition duration-150 z-50 ${
                          isSelected || hoveredComponentId === h.id
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-95"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-0.5">
                          <span className="text-[#ccff00] font-bold">{h.assetId}</span>
                          <span
                            className={`font-bold uppercase px-1.5 py-0.2 rounded text-[8px] ${
                              status === "offline"
                                ? "bg-red-950 text-red-400 border border-red-800"
                                : status === "degraded"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-[#182306] text-[#ccff00] border border-[#4d6313]"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white truncate">{h.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">{h.sub}</div>
                        <RiskLine risk={risk[h.id]} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Plate>
      </div>

      <TwinInspector
        view="smartcity"
        parts={hotspots}
        selectedId={selectedComponentId ?? null}
        onSelect={(id) => {
          handleSelectComponent(id);
          const h = hotspots.find((x) => x.id === id);
          if (h) stage.centerOn(h.coord[0], h.coord[1], WIDTH, HEIGHT);
        }}
        risk={risk}
        scored={scored}
        links={partLinks}
      />
      </div>

      {/* Floating Exit Fullscreen pill when in fullscreen */}
      {isFullScreen && (
        <button
          onClick={toggleFullScreen}
          className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-[#ccff00] hover:bg-[#d9ff33] text-black text-xs font-black rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-2 border border-black transition"
        >
          <Minimize2 className="w-4 h-4 text-black" />
          <span>Exit Full Screen (Esc)</span>
        </button>
      )}
    </div>
  );
}
