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
}

const MODELOS = [
  "Scooter",
  "Naked",
  "Desportiva",
  "Trail / Adventure",
  "Custom / Cruiser",
  "Motocross / Enduro",
  "Touring",
  "Supermotard",
];

export default function CommandPanel({ sendCommand, addLog, logs, running, onStop }: CommandPanelProps) {
  const [selectedModel, setSelectedModel] = useState("");

  function handleSendModel() {
    if (!selectedModel) {
      addLog("Selecione um modelo primeiro!", "#eab308");
      return;
    }

    let route: any = null;
    try {
      const raw = localStorage.getItem("sim_route");
      if (raw) route = JSON.parse(raw);
    } catch {
      route = null;
    }

    if (
      route &&
      route.start &&
      route.end &&
      typeof route.start.latitude === "number" &&
      typeof route.start.longitude === "number" &&
      typeof route.end.latitude === "number" &&
      typeof route.end.longitude === "number"
    ) {
      // Primeiro definir modelo, depois rota
      sendCommand({ acao: "definir_modelo", modelo: selectedModel });
      addLog("Modelo definido (auto) antes de enviar rota", "#f97316");
      setTimeout(() => {
        sendCommand({ acao: "definir_rota", route });
        addLog("Rota enviada (auto) após modelo definido", "#f97316");
      }, 500);
      return;
    }

    sendCommand({ acao: "definir_modelo", modelo: selectedModel });
  }

  function handleStop() {
    sendCommand({ acao: "parar" });
    setSelectedModel("");
    onStop?.();
  }

  return (
    <Card title="Controlo do Simulador" className="command-card">
      <div className="command-layout">
        {/* Coluna — Modelo */}
        <div className="command-col">
          <div className="section-label">
            <Bike size={14} />
            Modelo do Veículo
            {running ? (
              <span className="status-indicator active">● A correr</span>
            ) : (
              <span className="status-indicator">○ Idle</span>
            )}
          </div>
          <select
            className="control model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={running}
          >
            <option value="">— escolher modelo —</option>
            {MODELOS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-block"
            onClick={handleSendModel}
            disabled={running || !selectedModel}
          >
            <Play size={16} />
            Iniciar Simulação
          </button>
        </div>

        {/* Coluna — Eventos */}
        <div className="command-col">
          <div className="section-label">
            <Cpu size={14} />
            Simular Eventos & Falhas
          </div>
          <div className="cmd-grid">
            <button
              className="btn btn-danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "queda" })}
              disabled={!running}
            >
              <AlertTriangle size={14} />
              Queda
            </button>
            <button
              className="btn btn-danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "alternador" })}
              disabled={!running}
            >
              <AlertTriangle size={14} />
              Alternador
            </button>
            <button
              className="btn btn-danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "sobreaquecimento" })}
              disabled={!running}
            >
              <AlertTriangle size={14} />
              Calor
            </button>
            <button
              className="btn"
              onClick={() => sendCommand({ acao: "reset_eventos" })}
              disabled={!running}
            >
              <RefreshCcw size={14} />
              Reset
            </button>
          </div>
          <button
            className="btn btn-danger btn-block"
            style={{ marginTop: 8 }}
            onClick={handleStop}
            disabled={!running}
          >
            <Square size={14} />
            Parar Simulação
          </button>
        </div>
      </div>

      {/* Log */}
      <div className="log-section">
        <div className="section-label">
          <Terminal size={14} />
          Consola de Eventos
        </div>
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
