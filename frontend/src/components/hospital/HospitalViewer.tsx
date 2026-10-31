import React, { useState, useRef, useMemo, useEffect } from "react";
import { Plate } from "../iso/react/draw";
import { HospitalArt } from "./art";
import { WIDTH, HEIGHT, at } from "./view";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  HeartPulse,
  Zap,
  Activity,
  Eye,
} from "lucide-react";
import { RadarPing, RiskLine } from "../TwinRadar";
import type { TwinRisk } from "../../hooks/twinRisk";
import "./hospital.css";

interface HospHotspot {
  id: string;
  coord: [number, number];
  label: string;
  sub: string;
  metric: string;
  value: string;
}

const HOSP_HOTSPOTS: HospHotspot[] = [
  {
    id: "hosp-tower",
    coord: at([-50, -75, 45]),
    label: "Inpatient & Surgical Tower",
    sub: "4-Story Wing · 380 Acute Care Beds",
    metric: "Bed Occupancy",
    value: "84.2% (320 Beds)",
  },
  {
    id: "hosp-helipad",
    coord: at([-50, -75, 82]),
    label: "Rooftop Trauma Helipad",
    sub: "Elevated Deck · Night IFR Beacon",
    metric: "Helipad Status",
    value: "CLEAR / VFR ACTIVE",
  },
  {
    id: "hosp-trauma",
    coord: at([-175, 40, 24]),
    label: "Emergency Trauma & Triage",
    sub: "Ambulance Bay & Resuscitation",
    metric: "Triage Capacity",
    value: "14 Trauma Bays Ready",
  },
  {
    id: "hosp-oxygen",
    coord: at([130, -110, 52]),
    label: "Cryogenic Liquid O2 Farm",
    sub: "Twin 15,000L Bulk Vacuum Tanks",
    metric: "O2 Storage",
    value: "88.6% (14.2 Bar)",
  },
  {
    id: "hosp-generator",
    coord: at([135, 10, 24]),
    label: "Emergency Generator Plant",
    sub: "Dual 1,250 kVA Standby Diesels",
    metric: "Auto-Transfer",
    value: "STANDBY READY (<10s)",
  },
];

export function HospitalViewer({ risk = {} }: { risk?: Record<string, TwinRisk> }) {
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [selectedId, setSelectedId] = useState<string>("hosp-helipad");
  const [showHelipadLights, setShowHelipadLights] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) setIsFullScreen(false);
    };
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullScreen) setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, [isFullScreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
  const handleResetView = () => {
    setZoom(0.9);
    setPan({ x: 0, y: 0 });
  };

  const activeHotspot = useMemo(
    () => HOSP_HOTSPOTS.find((h) => h.id === selectedId) || HOSP_HOTSPOTS[0],
    [selectedId]
  );

  return (
    <div
      ref={containerRef}
      className={`select-none flex flex-col bg-[#08090d] overflow-hidden transition-all ${
        isFullScreen
          ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-2xl"
          : "relative flex flex-col w-full h-full border border-[#202634] rounded-xl shadow-2xl"
      }`}
    >
      {/* Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111319]/95 border-b border-[#202634] z-20 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#182306] border border-[#4d6313] text-[#ccff00]">
            <HeartPulse className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-white uppercase">
                Regional Trauma Hospital & Medical Campus
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#182306] text-[#ccff00] border border-[#4d6313]">
                HLT-001 / HLT-002 ANATOMY TWIN
              </span>
              {isFullScreen && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ccff00] text-black">
                  FULL SCREEN ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Surgical Tower · Active Rooftop Helipad · Cryogenic O2 Farm · 2,500 kVA Standby Generation
            </p>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="hidden xl:flex items-center gap-4 text-xs font-mono bg-[#161922] px-3 py-1.5 rounded-lg border border-[#202634] shadow-xs">
          <div className="flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-[#ccff00]" />
            <span className="text-slate-400">ICU Status:</span>
            <span className="text-white font-semibold">100% Nominal</span>
          </div>
          <div className="w-px h-3 bg-[#202634]" />
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#ccff00]" />
            <span className="text-slate-400">Medical O2:</span>
            <span className="text-white font-semibold">88.6% Full</span>
          </div>
          <div className="w-px h-3 bg-[#202634]" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#ccff00]" />
            <span className="text-slate-400">Diesel Genset:</span>
            <span className="text-[#ccff00] font-semibold">Standby Ready</span>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 bg-[#161922] p-1 rounded-lg border border-[#202634] shadow-xs">
          <button
            onClick={() => setShowHelipadLights(!showHelipadLights)}
            title="Toggle Helipad Beacon"
            className={`p-1.5 rounded transition border ${
              showHelipadLights ? "bg-[#182306] text-[#ccff00] border-[#4d6313]" : "bg-[#161922] text-slate-400 border-transparent"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            title="Toggle Hotspots"
            className={`p-1.5 rounded transition border ${
              showHotspots ? "bg-[#182306] text-[#ccff00] border-[#4d6313]" : "bg-[#161922] text-slate-400 border-transparent"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#202634] my-auto" />
          <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00]" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00]" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleResetView} className="p-1.5 rounded hover:bg-[#202636] text-slate-400 hover:text-[#ccff00]" title="Reset View">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-[#202634] my-auto" />
          <button
            onClick={toggleFullScreen}
            className={`p-1.5 rounded transition ${
              isFullScreen ? "bg-[#ccff00] text-black font-extrabold" : "hover:bg-[#202636] text-slate-400 hover:text-[#ccff00]"
            }`}
            title={isFullScreen ? "Exit Full Screen (Esc)" : "Full Screen (Expand View)"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4 text-black" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Isometric Stage */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 w-full bg-[#08090d] relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <Plate
          fig="FIG 05"
          title="REGIONAL TRAUMA HOSPITAL & HEALTHCARE CAMPUS"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        >
          <div className="relative pointer-events-auto" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full h-full iso-svg block"
              role="img"
              aria-label="Regional Trauma Hospital Isometric Diagram"
            >
              <HospitalArt
                selectedComponentId={selectedId}
                onSelectComponent={(id) => setSelectedId(id)}
                showHelipadLights={showHelipadLights}
              />
            </svg>

            {/* Hotspots */}
            {showHotspots && (
              <div className="hospital-hotspots-layer">
                {HOSP_HOTSPOTS.map((h) => {
                  const isSel = selectedId === h.id;
                  return (
                    <div
                      key={h.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(h.id);
                      }}
                      style={{
                        position: "absolute",
                        left: `${h.coord[0]}px`,
                        top: `${h.coord[1]}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                      className="group cursor-pointer z-30"
                    >
                      <div className="relative flex items-center justify-center">
                        <RadarPing risk={risk[h.id]} />
                        {isSel && (
                          <span className="absolute w-7 h-7 rounded-full bg-[#ccff00]/40 animate-ping pointer-events-none" />
                        )}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 transition shadow-lg ${
                            isSel ? "bg-[#ccff00] border-black scale-125 ring-2 ring-[#ccff00]" : "bg-rose-500 border-white"
                          }`}
                        />
                      </div>
                      <div
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-lg bg-[#111319]/98 border border-[#283244] shadow-2xl backdrop-blur-md pointer-events-none transition duration-150 z-50 ${
                          isSel ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-95"
                        }`}
                      >
                        <div className="text-[9px] font-mono text-[#ccff00] font-bold uppercase">{h.metric}: {h.value}</div>
                        <div className="text-xs font-bold text-white truncate">{h.label}</div>
                        <div className="text-[10px] text-slate-400">{h.sub}</div>
                        <RiskLine risk={risk[h.id]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Plate>
      </div>

      {/* Part selector */}
      <div className="twin-dock">
        <label className="twin-dock-label" htmlFor="twin-part-select">
          Highlight part
        </label>
        <select
          id="twin-part-select"
          className="twin-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {HOSP_HOTSPOTS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
        <span className="twin-dock-info">
          {activeHotspot.metric}: {activeHotspot.value}
        </span>
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
