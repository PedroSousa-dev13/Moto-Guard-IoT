// =============================================================================
// MotoGuard IoT — Simulator Player Bar
// =============================================================================
// A fixed-bottom player bar for the simulator page, designed exactly 1:1
// according to the reference image layout, colors, and adjusted width to
// prevent overlapping the sidebar.
// =============================================================================

import { useState, useEffect } from "react";
import type { SimulatorCommand, LogEntry, TelemetryPayload } from "../types/telemetry";
import {
  Play,
  Square,
  AlertTriangle,
  RefreshCcw,
  Terminal,
  Bike,
  Zap,
  Shield,
  ChevronDown,
} from "lucide-react";

interface SimulatorPlayerBarProps {
  sendCommand: (cmd: SimulatorCommand) => void;
  addLog: (msg: string, color?: string) => void;
  logs: LogEntry[];
  running: boolean;
  onStop?: () => void;
  allowedModels?: string[];
  telemetry?: TelemetryPayload | null;
  msgCount?: number;
}

const MODELOS = [
  "Scooter", "Naked", "Desportiva", "Trail / Adventure",
  "Custom / Cruiser", "Motocross / Enduro", "Touring", "Supermotard",
];

export default function SimulatorPlayerBar({
  sendCommand,
  addLog,
  logs,
  running,
  onStop,
  allowedModels,
  telemetry,
  msgCount = 0,
}: SimulatorPlayerBarProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("motoguard_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleSidebarToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.collapsed === 'boolean') {
        setSidebarCollapsed(customEvent.detail.collapsed);
      }
    };
    window.addEventListener('motoguard_sidebar_toggle', handleSidebarToggle);
    return () => {
      window.removeEventListener('motoguard_sidebar_toggle', handleSidebarToggle);
    };
  }, []);

  // Track whether a valid route exists in localStorage
  const [hasRoute, setHasRoute] = useState(() => {
    try {
      const raw = localStorage.getItem("sim_route");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed?.start?.latitude && parsed?.end?.latitude);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleRouteChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.hasRoute === 'boolean') {
        setHasRoute(customEvent.detail.hasRoute);
      }
    };
    window.addEventListener('motoguard_route_changed', handleRouteChanged);
    return () => {
      window.removeEventListener('motoguard_route_changed', handleRouteChanged);
    };
  }, []);

  const isLoadingModels = allowedModels !== undefined && allowedModels.length === 0;
  const modelOptions = allowedModels !== undefined ? allowedModels : MODELOS;
  const effectiveModel = modelOptions.includes(selectedModel) ? selectedModel : "";

  function handleSendModel() {
    if (!effectiveModel) {
      addLog("Selecione um modelo primeiro!", "#eab308");
      return;
    }
    if (!hasRoute) {
      addLog("Defina uma rota primeiro no Planeador de Rotas!", "#ef4444");
      return;
    }
    let route: any = null;
    try {
      const raw = localStorage.getItem("sim_route");
      if (raw) route = JSON.parse(raw);
    } catch {
      route = null;
    }
    const activeRoute =
      route?.start &&
      route?.end &&
      typeof route.start.latitude === "number" &&
      typeof route.end.latitude === "number"
        ? route
        : null;
    if (!activeRoute) {
      addLog("Rota inválida — defina uma rota no Planeador de Rotas.", "#ef4444");
      return;
    }
    sendCommand({ acao: "definir_modelo", modelo: effectiveModel, _route: activeRoute } as any);
    addLog("Modelo definido — a enviar rota...", "#f97316");
  }

  function handleStop() {
    sendCommand({ acao: "parar", source: "SIMULATOR" } as any);
    setSelectedModel("");
    onStop?.();
  }

  return (
    <>
      {/* ── PLAYER BAR (fixed bottom wrapper) ────────────────────────── */}
      {/* Dynamic offset left-0 md:left-72 to respect the expanded sidebar width */}
      <div
        className={`fixed bottom-0 right-0 z-[100] px-4 md:px-8 pb-[5px] pointer-events-none flex flex-col items-center gap-3 transition-all duration-300 ${
          sidebarCollapsed ? "left-0" : "left-0 md:left-72"
        }`}
      >
        {/* Main bar (positioned above the console in the layout flow, max-width compressed to 1250px) */}
        <div
          className="w-full max-w-[1250px] border rounded-[2.5rem] player-bar-container transition-all duration-300 pointer-events-auto"
        >
          {/* Spreading the sections across the player bar on desktop */}
          <div className="flex flex-col xl:flex-row items-center xl:justify-between xl:gap-2 px-8 xl:px-14 py-4 min-h-[88px] gap-6">
            
            {/* ── Section 1: Model Selector (Left) ──────────────────── */}
            <div className="flex flex-col shrink-0 w-full xl:w-[220px]">
              <div className="flex items-center justify-between xl:justify-start gap-2.5">
                <div className="flex items-center gap-2">
                  <Bike size={14} className="text-accent" />
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text whitespace-nowrap">
                    SELECIONAR MODELO
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[0.45rem] font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
                      running
                        ? "bg-green/10 text-green border-green/20"
                        : "bg-surface border-border-glass text-muted"
                    }`}
                  >
                    {running ? "• LIVE" : "• IDLE"}
                  </span>

                  {/* Console Toggle Button next to Status Badge */}
                  <button
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-mono border transition-all ${
                      consoleOpen
                        ? "bg-accent/20 border-accent/40 text-accent"
                        : "player-bar-btn border hover:bg-white/5"
                    }`}
                    onClick={() => setConsoleOpen((v) => !v)}
                    title={consoleOpen ? "Fechar Consola" : "Abrir Consola"}
                  >
                    &gt;_
                  </button>
                </div>
              </div>

              {/* Full width dropdown for this section */}
              <div className="relative mt-2 w-full">
                {isLoadingModels ? (
                  <select
                    className="w-full player-bar-select border rounded-full pl-4 pr-10 py-1.5 text-[0.7rem] font-bold text-muted outline-none cursor-not-allowed appearance-none text-center"
                    disabled
                  >
                    <option>A CARREGAR...</option>
                  </select>
                ) : modelOptions.length === 0 ? (
                  <div className="w-full player-bar-select border rounded-full px-4 py-1.5 text-[0.7rem] font-bold text-muted text-center">
                    SEM MOTAS
                  </div>
                ) : (
                  <>
                    <select
                      value={effectiveModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={running}
                      className="w-full player-bar-select border rounded-full pl-4 pr-10 py-1.5 text-[0.7rem] font-bold text-text outline-none disabled:opacity-40 disabled:cursor-not-allowed appearance-none cursor-pointer tracking-wider text-center"
                    >
                      <option value="" className="player-bar-select option">— escolher modelo —</option>
                      {modelOptions.map((m) => (
                        <option key={m} value={m} className="player-bar-select option">
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  </>
                )}
              </div>
            </div>

            {/* ── Section 2: Play / Stop Controls (Center-Left) ──────── */}
            <div className="flex items-center gap-4 shrink-0">
              <button
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  running || !effectiveModel || isLoadingModels || !hasRoute
                    ? "bg-black/[0.02] text-black/20 cursor-not-allowed border border-black/10 dark:bg-white/[0.02] dark:text-white/20 dark:border-white/10 player-bar-btn-play-disabled"
                    : "bg-[#b58dfb] text-black shadow-[0_0_18px_rgba(181,141,251,0.35)] hover:bg-[#c29ffa] hover:scale-105 active:scale-95 animate-pulse-subtle player-bar-btn-play-active"
                }`}
                onClick={handleSendModel}
                disabled={running || !effectiveModel || isLoadingModels || !hasRoute}
                title={!hasRoute ? "Defina uma rota primeiro no Planeador de Rotas" : "Iniciar Simulação"}
              >
                <Play
                  size={20}
                  className={`fill-current ml-1 ${
                    running || !effectiveModel || isLoadingModels || !hasRoute
                      ? "text-black/20 dark:text-white/20"
                      : "player-bar-play-icon"
                  }`}
                />
              </button>
              <button
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  !running
                    ? "bg-black/[0.01] text-black/10 cursor-not-allowed border border-black/5 dark:bg-white/[0.01] dark:text-white/10 dark:border-white/5 player-bar-btn-stop-disabled"
                    : "player-bar-btn border active:scale-95 player-bar-btn-stop-active"
                }`}
                onClick={handleStop}
                disabled={!running}
                title="Parar Simulação"
              >
                <Square size={10} className="fill-current text-muted" />
              </button>
            </div>

            {/* Vertical Separator */}
            <div className="hidden xl:block w-px h-10 player-bar-separator self-center" />

            {/* ── Section 3: Simular Eventos (Center-Right) ─────────── */}
            <div className="flex flex-col items-center xl:items-start gap-2 shrink-0">
              <span className="text-[0.52rem] font-bold uppercase tracking-[0.15em] text-muted whitespace-nowrap">
                SIMULAR EVENTOS E FALHAS
              </span>
              <div className="flex items-center gap-3">
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all border player-bar-btn hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-20 disabled:pointer-events-none"
                  onClick={() => sendCommand({ acao: "evento", tipo: "queda" })}
                  disabled={!running}
                  title="Forçar Queda"
                >
                  <AlertTriangle size={13} />
                </button>
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all border player-bar-btn hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/30 disabled:opacity-20 disabled:pointer-events-none"
                  onClick={() => sendCommand({ acao: "reset_eventos" })}
                  disabled={!running}
                  title="Reset Eventos"
                >
                  <RefreshCcw size={13} />
                </button>
              </div>
            </div>

            {/* Vertical Separator */}
            <div className="hidden xl:block w-px h-10 player-bar-separator self-center" />

            {/* ── Section 4: Controlos Manuais (Right) ────────────────── */}
            <div className="flex flex-col items-center xl:items-start gap-2 shrink-0">
              <span className="text-[0.52rem] font-bold uppercase tracking-[0.15em] text-muted whitespace-nowrap">
                CONTROLOS MANUAIS (HOLD)
              </span>
              <div className="flex items-center gap-3">
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all border player-bar-btn hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 active:scale-95 disabled:opacity-20 disabled:pointer-events-none select-none"
                  onMouseDown={() => sendCommand({ acao: "override", tipo: "throttle", active: true })}
                  onMouseUp={() => sendCommand({ acao: "override", tipo: "throttle", active: false })}
                  onMouseLeave={() => sendCommand({ acao: "override", tipo: "throttle", active: false })}
                  onTouchStart={() => sendCommand({ acao: "override", tipo: "throttle", active: true })}
                  onTouchEnd={() => sendCommand({ acao: "override", tipo: "throttle", active: false })}
                  disabled={!running}
                  title="Acelerar (segurar)"
                >
                  <Zap size={13} />
                </button>
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all border player-bar-btn hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30 active:scale-95 disabled:opacity-20 disabled:pointer-events-none select-none"
                  onMouseDown={() => sendCommand({ acao: "override", tipo: "brake", active: true })}
                  onMouseUp={() => sendCommand({ acao: "override", tipo: "brake", active: false })}
                  onMouseLeave={() => sendCommand({ acao: "override", tipo: "brake", active: false })}
                  onTouchStart={() => sendCommand({ acao: "override", tipo: "brake", active: true })}
                  onTouchEnd={() => sendCommand({ acao: "override", tipo: "brake", active: false })}
                  disabled={!running}
                  title="Travar (segurar)"
                >
                  <Shield size={13} />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Console panel (slides up UNDER the bar, max-width compressed to 1250px) */}
        <div
          className="w-full max-w-[1250px] transition-all duration-300 ease-out overflow-hidden pointer-events-auto"
          style={{
            maxHeight: consoleOpen ? "220px" : "0px",
            opacity: consoleOpen ? 1 : 0,
          }}
        >
          <div className="backdrop-blur-2xl border rounded-3xl px-5 py-3 h-[220px] flex flex-col player-bar-console">
            <div className="flex items-center justify-between border-b border-white/[0.04] dark:border-black/[0.04] pb-2">
              <div className="flex items-center gap-2 text-[0.6rem] font-black uppercase tracking-[0.2em] text-accent/80">
                <Terminal size={12} />
                Consola de Eventos
              </div>
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest">
                {logs.length} entries
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-2 flex flex-col gap-1.5">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted">
                  A aguardar eventos...
                </div>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="text-[0.65rem] font-bold flex gap-2 animate-fade-in">
                    <span className="text-muted shrink-0 font-black tabular-nums">[{entry.time}]</span>
                    <span className="break-words" style={{ color: entry.color }}>{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Spacer to prevent page content from being hidden behind the bar ── */}
      <div className={`shrink-0 transition-all duration-300 ${consoleOpen ? "h-[320px]" : "h-[100px]"}`} />
    </>
  );
}
