// =============================================================================
// CommandPanel — Seletor de modelo + botões de eventos + log
// =============================================================================

import { useState } from "react";
import type { SimulatorCommand, LogEntry } from "../types/telemetry";

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
    <div className="card command-card">
      <h2>🎮 Comandos do Simulador</h2>
      <div className="command-layout">
        {/* Coluna — Modelo */}
        <div className="command-col">
          <label className="cmd-label">
            Selecionar Modelo{" "}
            {running ? (
              <span style={{ color: "#22c55e", fontWeight: 600 }}>● A correr</span>
            ) : (
              <span style={{ color: "#71717a" }}>○ Idle</span>
            )}
          </label>
          <select
            className="model-select"
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
            className="cmd-btn"
            onClick={handleSendModel}
            style={{ width: "100%" }}
            disabled={running || !selectedModel}
          >
            ▶ Definir Modelo &amp; Iniciar
          </button>
        </div>

        {/* Coluna — Eventos */}
        <div className="command-col">
          <label className="cmd-label">Simular Eventos</label>
          <div className="cmd-grid">
            <button
              className="cmd-btn danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "queda" })}
              disabled={!running}
            >
              💥 Queda
            </button>
            <button
              className="cmd-btn danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "alternador" })}
              disabled={!running}
            >
              🔋 Falha Alternador
            </button>
            <button
              className="cmd-btn danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "sobreaquecimento" })}
              disabled={!running}
            >
              🌡️ Sobreaquecimento
            </button>
            <button
              className="cmd-btn"
              onClick={() => sendCommand({ acao: "reset_eventos" })}
              disabled={!running}
            >
              🔄 Reset Eventos
            </button>
            <button
              className="cmd-btn danger"
              onClick={handleStop}
              disabled={!running}
            >
              ⏹ Parar Simulador
            </button>
          </div>
        </div>
      </div>

      {/* Log */}
      <h2 style={{ marginTop: 12 }}>📋 Log</h2>
      <div className="log-area">
        {logs.map((entry, i) => (
          <div key={i} className="log-entry">
            <span className="log-time">{entry.time}</span>{" "}
            <span style={{ color: entry.color }}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
