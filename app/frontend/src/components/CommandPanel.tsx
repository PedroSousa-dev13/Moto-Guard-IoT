import { useState } from "react";
import type { SimulatorCommand, LogEntry } from "../types/telemetry";
import Card from "./ui/Card";
import { Play, Square, AlertTriangle, RefreshCcw, Terminal, Bike, Cpu } from 'lucide-react';

interface CommandPanelProps {
  sendCommand: (cmd: SimulatorCommand) => void;
  addLog: (msg: string, color?: string) => void;
  logs: LogEntry[];
  running: boolean;
  onStop?: () => void;
  allowedModels?: string[];
}

const MODELOS = [
  "Scooter", "Naked", "Desportiva", "Trail / Adventure",
  "Custom / Cruiser", "Motocross / Enduro", "Touring", "Supermotard",
];

const DEFAULT_ROUTE = {
  start: { latitude: 41.2951, longitude: -7.7463 },
  end:   { latitude: 41.3045, longitude: -7.7388 },
  loop: false,
};

export default function CommandPanel({ sendCommand, addLog, logs, running, onStop, allowedModels }: CommandPanelProps) {
  const [selectedModel, setSelectedModel] = useState("");

  const isLoadingModels = allowedModels !== undefined && allowedModels.length === 0;
  const modelOptions = allowedModels !== undefined ? allowedModels : MODELOS;
  const effectiveModel = modelOptions.includes(selectedModel) ? selectedModel : "";

  function handleSendModel() {
    if (!effectiveModel) { addLog("Selecione um modelo primeiro!", "#eab308"); return; }
    let route: any = null;
    try { const raw = localStorage.getItem("sim_route"); if (raw) route = JSON.parse(raw); } catch { route = null; }
    const activeRoute = (route?.start && route?.end &&
      typeof route.start.latitude === "number" && typeof route.end.latitude === "number"
    ) ? route : DEFAULT_ROUTE;
    sendCommand({ acao: "definir_modelo", modelo: effectiveModel });
    addLog("Modelo definido — a enviar rota...", "#f97316");
    setTimeout(() => {
      sendCommand({ acao: "definir_rota", route: activeRoute });
      addLog(activeRoute === DEFAULT_ROUTE ? "Rota padrão enviada" : "Rota personalizada enviada", "#f97316");
    }, 500);
  }

  function handleStop() {
    sendCommand({ acao: "parar" });
    setSelectedModel("");
    onStop?.();
  }

  return (
    <Card title="Controlo do Simulador">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Coluna 1 — Modelo */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">
            <Bike size={14} />
            Modelo do Veículo
            {running
              ? <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[0.55rem] font-black uppercase tracking-widest bg-green/10 text-green border border-green/20">● A correr</span>
              : <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[0.55rem] font-black uppercase tracking-widest bg-panel border border-border-glass-subtle text-muted">○ Idle</span>}
          </div>
          {isLoadingModels ? (
            <select className="w-full bg-panel border border-border-glass-subtle rounded-xl px-4 py-2.5 text-sm font-black text-text outline-none opacity-50 cursor-not-allowed" disabled><option>A carregar motas...</option></select>
          ) : modelOptions.length === 0 ? (
            <div className="w-full bg-panel border border-border-glass-subtle rounded-xl px-4 py-2.5 text-[0.65rem] font-black text-muted uppercase tracking-widest opacity-40">
              Sem motas na garagem.
            </div>
          ) : (
            <select 
              className="w-full bg-panel border border-border-glass-subtle rounded-xl px-4 py-2.5 text-sm font-black text-text outline-none focus:border-accent transition-colors appearance-none cursor-pointer disabled:opacity-50"
              value={effectiveModel}
              onChange={(e) => setSelectedModel(e.target.value)} 
              disabled={running}
            >
              <option value="">— escolher modelo —</option>
              {modelOptions.map((m) => <option key={m} value={m} className="bg-surface">{m}</option>)}
            </select>
          )}
          <button 
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-[0.65rem] uppercase tracking-widest transition-all bg-accent text-white shadow-lg shadow-accent/20 hover:scale-[1.02] hover:bg-accent-strong disabled:opacity-30 disabled:pointer-events-none"
            onClick={handleSendModel}
            disabled={running || !effectiveModel || isLoadingModels}
          >
            <Play size={16} /> Iniciar Simulação
          </button>
        </div>

        {/* Coluna 2 — Eventos + Parar */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">
            <Cpu size={14} /> Simular Eventos & Falhas
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Queda", icon: <AlertTriangle size={14} />, type: "queda", color: "red" },
              { label: "Alternador", icon: <AlertTriangle size={14} />, type: "alternador", color: "red" },
              { label: "Calor", icon: <AlertTriangle size={14} />, type: "sobreaquecimento", color: "red" },
              { label: "Reset", icon: <RefreshCcw size={14} />, type: "reset_eventos", color: "neutral" },
            ].map((ev) => (
              <button 
                key={ev.type}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[0.65rem] uppercase tracking-widest transition-all border disabled:opacity-30 disabled:pointer-events-none ${
                  ev.color === "red" 
                    ? "bg-red/10 border-red/20 text-red hover:bg-red hover:text-white"
                    : "bg-panel border-border-glass-subtle text-muted hover:text-text hover:border-border-glass"
                }`}
                onClick={() => ev.type === "reset_eventos" ? sendCommand({ acao: "reset_eventos" }) : sendCommand({ acao: "evento", tipo: ev.type })}
                disabled={!running}
              >
                {ev.icon} {ev.label}
              </button>
            ))}
          </div>
          <button 
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-[0.65rem] uppercase tracking-widest transition-all bg-red/10 border border-red/20 text-red hover:bg-red hover:text-white disabled:opacity-30 disabled:pointer-events-none mt-auto"
            onClick={handleStop}
            disabled={!running}
          >
            <Square size={14} /> Parar Simulação
          </button>
        </div>

      </div>

      {/* Log */}
      <div className="mt-8 pt-8 border-t border-border-glass-subtle flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">
          <Terminal size={14} /> Consola de Eventos
        </div>
        <div className="bg-panel border border-border-glass-subtle rounded-2xl p-4 h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          {logs.length === 0 && (
            <div className="h-full flex items-center justify-center text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-20">
              A aguardar eventos...
            </div>
          )}
          {logs.map((entry, i) => (
            <div key={i} className="text-[0.7rem] font-bold flex gap-2 animate-fade-in">
              <span className="text-muted opacity-40 shrink-0 font-black">[{entry.time}]</span>
              <span className="break-words" style={{ color: entry.color }}>{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
