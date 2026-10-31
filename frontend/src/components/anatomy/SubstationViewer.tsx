"use client";

import { useState, useMemo, useEffect } from "react";
import { Plate } from "../iso/react/draw";
import { SubstationArt } from "./art";
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
  Info,
} from "lucide-react";
import { RadarPing } from "../TwinRadar";
import type { TwinRisk } from "../../hooks/twinRisk";
import "./substation.css";
import { useStageView } from "../twin/useStageView";
import { FlowOverlay, type LinkMode } from "../twin/FlowOverlay";
import { TwinInspector } from "../twin/TwinInspector";
import { useTwinNav } from "../twin/TwinNav";
import { useLatestRun } from "../../hooks/queries";
import { usePartLinks } from "../../hooks/twinConnections";

interface SubstationViewerProps {
  assets: InfrastructureAsset[];
  selectedAsset: InfrastructureAsset | null;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  isSimulationActive?: boolean;
  failedAssetIds?: string[];
  affectedAssetIds?: string[];
  risk?: Record<string, TwinRisk>;
}

export function SubstationViewer({
  assets,
  selectedAsset,
  onSelectAsset,
  isSimulationActive = false,
  failedAssetIds = [],
  affectedAssetIds = [],
  risk = {},
}: SubstationViewerProps) {
  // Shared pan / zoom / fullscreen (drag, wheel, pinch, keyboard)
  const stage = useStageView({ initialZoom: 0.8, content: { width: WIDTH, height: HEIGHT } });
  const { zoom, isFullScreen, toggleFullScreen } = stage;
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
  const [showJumpers, setShowJumpers] = useState<boolean>(true);
  const [showGroundGrid, setShowGroundGrid] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showStatusVisuals, setShowStatusVisuals] = useState<boolean>(true);

  // Hover state for interactive readout
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);


  // Map of componentId -> InfrastructureAsset
  const componentToAssetMap = useMemo(() => {
    const map = new Map<string, InfrastructureAsset>();
    assets.forEach((asset) => {
      if (asset.substationComponentId) {
        map.set(asset.substationComponentId, asset);
      }
    });
    return map;
  }, [assets]);

  // Map of componentId -> status
  const statusMap = useMemo(() => {
    const map: Record<string, "operational" | "degraded" | "offline" | "maintenance"> = {};
    if (!showStatusVisuals) return map;

    assets.forEach((asset) => {
      if (!asset.substationComponentId) return;

      if (isSimulationActive) {
        if (failedAssetIds.includes(asset.id)) {
          map[asset.substationComponentId] = "offline";
        } else if (affectedAssetIds.includes(asset.id)) {
          map[asset.substationComponentId] = "degraded";
        } else {
          map[asset.substationComponentId] = "operational";
        }
      } else {
        map[asset.substationComponentId] = asset.status;
      }
    });

    return map;
  }, [assets, isSimulationActive, failedAssetIds, affectedAssetIds, showStatusVisuals]);

  // Active selected component ID
  const selectedComponentId = selectedAsset?.substationComponentId;

  // Hotspots projected 2D coordinates
  const hotspots = useMemo(() => {
    return [
      {
        id: "sub-transformer",
        label: "Power Transformer",
        coord: at([-95, 0, 48]),
        assetId: "SUB-TR-01",
      },
      {
        id: "sub-circuit-breaker",
        label: "SF6 Circuit Breaker",
        coord: at([65, -52, 78]),
        assetId: "SUB-CB-01",
      },
      {
        id: "sub-disconnect-switch",
        label: "Disconnect Switch",
        coord: at([160, -54, 65]),
        assetId: "SUB-DS-01",
      },
      {
        id: "sub-busbar-gantry",
        label: "33kV Busbar Gantry",
        coord: at([0, -24, 126]),
        assetId: "SUB-BB-01",
      },
      {
        id: "sub-control-cabinet",
        label: "Protection & RTU Cabinet",
        coord: at([-85, 94, 45]),
        assetId: "SUB-CP-01",
      },
      {
        id: "sub-radiators",
        label: "Cooling Radiators",
        coord: at([-102, -42, 38]),
        assetId: "SUB-RAD-01",
      },
      {
        id: "sub-bushings",
        label: "HV Bushings",
        coord: at([-94, -18, 96]),
        assetId: "SUB-BUSH-01",
      },
      {
        id: "sub-lightning-arrester",
        label: "Lightning Arresters",
        coord: at([60, 34, 52]),
        assetId: "SUB-LA-01",
      },
      {
        id: "sub-grounding",
        label: "Earthing Grid",
        coord: at([0, 0, 4]),
        assetId: "SUB-GND-01",
      },
    ];
  }, []);

  // Component Selection Handler
  const handleSelectComponent = (compKey: string) => {
    const targetAsset = componentToAssetMap.get(compKey);
    if (targetAsset) {
      onSelectAsset(targetAsset);
    }
  };


  // Dynamic Live Readout
  const activeAsset = hoveredComponentId
    ? componentToAssetMap.get(hoveredComponentId)
    : selectedAsset;

  const readoutText = useMemo(() => {
    if (isSimulationActive) {
      if (activeAsset && failedAssetIds.includes(activeAsset.id)) {
        return `SIMULATION: [TRIPPED OFFLINE] ${activeAsset.name}`;
      }
      if (activeAsset && affectedAssetIds.includes(activeAsset.id)) {
        return `SIMULATION: [CASCADING RISK] ${activeAsset.name}`;
      }
    }
    if (activeAsset && activeAsset.telemetry) {
      return `${activeAsset.name.toUpperCase()} · ${activeAsset.telemetry.metricName}: ${activeAsset.telemetry.value} ${activeAsset.telemetry.unit}`;
    }
    if (activeAsset) {
      return `${activeAsset.name.toUpperCase()} · 33/11kV SYSTEM NOMINAL`;
    }
    return "SUBSTATION ATLAS · ALL SYSTEMS 33kV OPERATIONAL";
  }, [activeAsset, isSimulationActive, failedAssetIds, affectedAssetIds]);

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
          : "relative flex flex-col h-full w-full bg-[#08090d] border border-[#202634] rounded-lg shadow-xl"
      }`}
    >
      {/* Top Toolbar / Component Quick Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#111319]/95 border-b border-[#202634] text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#ccff00] animate-pulse" />
          <span className="font-bold text-white tracking-wide">
            33/11kV SUBSTATION DIGITAL TWIN
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#182306] text-[#ccff00] border border-[#4d6313] font-mono">
            SVG ISOMETRIC MODEL
          </span>
          {isFullScreen && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ccff00] text-black">
              FULL SCREEN ACTIVE
            </span>
          )}
        </div>

        <select
          className="twin-select"
          aria-label="Highlight a part of the diagram"
          value={selectedComponentId ?? ""}
          onChange={(e) => handleSelectComponent(e.target.value)}
        >
          {hotspots.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>


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
        {/* View & Layer Controls */}
        <div className="flex items-center gap-1.5 bg-[#161922] p-1 rounded-lg border border-[#202634]">
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            title="Toggle Hotspots"
            className={`p-1.5 rounded transition border ${
              showHotspots
                ? "bg-[#182306] text-[#ccff00] border-[#4d6313]"
                : "bg-[#161922] text-slate-400 hover:text-white border-transparent"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowJumpers(!showJumpers)}
            title="Toggle Power Feed Cables"
            className={`p-1.5 rounded transition border ${
              showJumpers
                ? "bg-[#182306] text-[#ccff00] border-[#4d6313]"
                : "bg-[#161922] text-slate-400 hover:text-white border-transparent"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowGroundGrid(!showGroundGrid)}
            title="Toggle Earth Grounding Grid"
            className={`p-1.5 rounded transition border ${
              showGroundGrid
                ? "bg-[#182306] text-[#ccff00] border-[#4d6313]"
                : "bg-[#161922] text-slate-400 hover:text-white border-transparent"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowStatusVisuals(!showStatusVisuals)}
            title="Toggle Status Visualizations"
            className={`p-1.5 rounded transition border ${
              showStatusVisuals
                ? "bg-[#182306] text-[#ccff00] border-[#4d6313]"
                : "bg-[#161922] text-slate-400 hover:text-white border-transparent"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-[#202634] mx-1" />

          {/* Zoom & Pan Buttons */}
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            title="Reset View"
            className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-[#202634] mx-1" />

          {/* Full Screen Toggle */}
          <button
            onClick={toggleFullScreen}
            title={isFullScreen ? "Exit Full Screen (Esc)" : "Full Screen"}
            className={`p-1.5 rounded border transition ${
              isFullScreen
                ? "bg-[#ccff00] border-[#ccff00] text-black font-extrabold"
                : "hover:bg-[#202636] text-slate-400 hover:text-[#ccff00] border-transparent"
            }`}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5 text-black" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Anatomy SVG Stage */}
      <div className="ts-body">
      <div
        ref={stage.stageRef}
        {...stage.stageProps}
        aria-label="Substation diagram. Drag to pan, scroll to zoom, plus and minus keys to zoom."
        className={`relative min-w-0 overflow-hidden bg-[#08090d] outline-none ${
          stage.dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ ...stage.stageProps.style, minHeight: "440px" }}
      >
        <Plate
          fig="FIG 01"
          title="33/11kV BULK SUPPLY SUBSTATION ASSEMBLY"
          hint="DRAG TO PAN · CLICK PART TO INSPECT · HOVER TO PROBE"
          readout={readoutText}
          keys={[
            { mark: "lit", label: "Selected Active Component" },
            { mark: "raised", label: "Engineered High-Voltage Solids" },
            { mark: "edge", label: "33kV Flexible Dropper Jumpers" },
            { mark: "dotted", label: "Buried Earth Grounding Grid" },
          ]}
          caption="Detailed isometric digital twin of a critical municipal electrical substation assembly: 25MVA power transformer, forced cooling radiators, SF6 circuit breaker, motorized disconnect switch, surge arresters, overhead gantry busbars, and digital protection cabinet."
        >
          <div
            className="w-full h-full flex items-center justify-center"
            style={stage.transformStyle}
          >
            <div className="relative" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full h-full iso-svg block"
                role="img"
                aria-label="Electrical Substation Digital Twin Isometric Diagram"
              >
                <SubstationArt
                  selectedComponentId={selectedComponentId}
                  statusMap={statusMap}
                  showJumpers={showJumpers}
                  showGroundGrid={showGroundGrid}
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

              {/* Interactive Hotspot Pins Overlay */}
              {showHotspots && (
                <div className="absolute inset-0 pointer-events-none">
                  {hotspots.map((spot) => {
                    const isSelected = selectedComponentId === spot.id;
                    const status = statusMap[spot.id] || "operational";
                    const isHovered = hoveredComponentId === spot.id;

                    let badgeColor = "bg-[#111319]/95 text-slate-200 border-[#283244] shadow-md";
                    let dotColor = "bg-[#ccff00]";

                    if (status === "offline") {
                      badgeColor = "bg-red-950/90 text-red-300 border-red-800 shadow-sm";
                      dotColor = "bg-red-500 animate-ping";
                    } else if (status === "degraded") {
                      badgeColor = "bg-amber-950/90 text-amber-300 border-amber-800 shadow-sm";
                      dotColor = "bg-amber-500";
                    } else if (isSelected) {
                      badgeColor = "bg-[#ccff00] text-black border-[#ccff00] font-black shadow-lg";
                      dotColor = "bg-black";
                    }

                    return (
                      <div
                        key={spot.id}
                        className="substation-hotspot absolute pointer-events-auto cursor-pointer" role="button" tabIndex={0} aria-label={spot.label} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectComponent(spot.id); } }} onFocus={() => setHoveredComponentId(spot.id)} onBlur={() => setHoveredComponentId(null)}
                        style={{
                          left: `${spot.coord[0]}px`,
                          top: `${spot.coord[1]}px`,
                        }}
                        onClick={() => handleSelectComponent(spot.id)}
                        onMouseEnter={() => setHoveredComponentId(spot.id)}
                        onMouseLeave={() => setHoveredComponentId(null)}
                      >
                        <RadarPing risk={risk[spot.id]} />
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono shadow-sm backdrop-blur-xs transition ${badgeColor} ${
                            isHovered || isSelected ? "scale-105 z-20" : "opacity-90 hover:opacity-100"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                          <span className="font-sans font-semibold tracking-tight">
                            {spot.label}
                            {risk[spot.id] && (
                              <span className="font-mono ml-1 opacity-80">
                                {risk[spot.id].score.toFixed(0)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Plate>
      </div>

      <TwinInspector
        view="power"
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

      {/* Floating Status Bar / Telemetry Footer */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#111319]/95 border-t border-[#202634] text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Info className="w-3.5 h-3.5 text-[#ccff00]" />
            <span>SELECTED:</span>
            <span className="text-[#ccff00] font-bold">
              {activeAsset ? activeAsset.name : "None (Substation Overview)"}
            </span>
          </span>
          {activeAsset?.telemetry && (
            <span className="hidden sm:inline text-slate-400">
              {activeAsset.telemetry.metricName}:{" "}
              <span className="text-white font-semibold">
                {activeAsset.telemetry.value} {activeAsset.telemetry.unit}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>ZOOM: {Math.round(zoom * 100)}%</span>
          <span className="text-slate-600">|</span>
          <span className="text-[#ccff00] flex items-center gap-1 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00]" />
            ILLUSTRATIVE MODEL
          </span>
        </div>
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
