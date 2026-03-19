import React, { useState } from "react";
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
    <Card title="Controlo do Simulador" className="command-card">
      <div className="command-layout">

        {/* Coluna 1 — Modelo */}
        <div className="command-col">
          <div className="section-label">
            <Bike size={14} />
            Modelo do Veículo
            {running
              ? <span className="status-indicator active">● A correr</span>
              : <span className="status-indicator">○ Idle</span>}
          </div>
          {isLoadingModels ? (
            <select className="control model-select" disabled><option>A carregar motas...</option></select>
          ) : modelOptions.length === 0 ? (
            <div className="control" style={{ color: "var(--muted)", fontSize: 13, padding: "8px 12px" }}>
              Sem motas na garagem. Adiciona uma mota primeiro.
            </div>
          ) : (
            <select className="control model-select" value={effectiveModel}
              onChange={(e) => setSelectedModel(e.target.value)} disabled={running}>
              <option value="">— escolher modelo —</option>
              {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-block" onClick={handleSendModel}
            disabled={running || !effectiveModel || isLoadingModels}>
            <Play size={16} /> Iniciar Simulação
          </button>
        </div>

        {/* Coluna 2 — Eventos + Parar */}
        <div className="command-col">
          <div className="section-label"><Cpu size={14} />Simular Eventos & Falhas</div>
          <div className="cmd-grid">
            <button className="btn btn-danger" onClick={() => sendCommand({ acao: "evento", tipo: "queda" })} disabled={!running}>
              <AlertTriangle size={14} /> Queda
            </button>
            <button className="btn btn-danger" onClick={() => sendCommand({ acao: "evento", tipo: "alternador" })} disabled={!running}>
              <AlertTriangle size={14} /> Alternador
            </button>
            <button className="btn btn-danger" onClick={() => sendCommand({ acao: "evento", tipo: "sobreaquecimento" })} disabled={!running}>
              <AlertTriangle size={14} /> Calor
            </button>
            <button className="btn" onClick={() => sendCommand({ acao: "reset_eventos" })} disabled={!running}>
              <RefreshCcw size={14} /> Reset
            </button>
          </div>
          <button className="btn btn-danger btn-block" style={{ marginTop: 8 }}
            onClick={handleStop} disabled={!running}>
            <Square size={14} /> Parar Simulação
          </button>
        </div>

      </div>

      {/* Log */}
      <div className="log-section">
        <div className="section-label"><Terminal size={14} />Consola de Eventos</div>
        <div className="log-area">
          {logs.length === 0 && <div className="log-empty">A aguardar eventos...</div>}
          {logs.map((entry, i) => (
            <div key={i} className="log-entry">
              <span className="log-time">[{entry.time}]</span>{" "}
              <span className="log-msg" style={{ color: entry.color }}>{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
