// =============================================================================
// CommandPanel — Seletor de modelo + botões de eventos + log
// =============================================================================

import { useState } from "react";
import type { SimulatorCommand, LogEntry } from "../types/telemetry";

interface CommandPanelProps {
  sendCommand: (cmd: SimulatorCommand) => void;
  addLog: (msg: string, color?: string) => void;
  logs: LogEntry[];
}

const MODELOS = [
  "Scooter",
  "Naked",
  "Desportiva",
  "Trail",
  "Cruiser",
  "Motocross",
  "Touring",
  "Supermotard",
];

export default function CommandPanel({ sendCommand, addLog, logs }: CommandPanelProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const [simRunning, setSimRunning] = useState(false);

  function handleSendModel() {
    if (!selectedModel) {
      addLog("Selecione um modelo primeiro!", "#eab308");
      return;
    }
    sendCommand({ acao: "definir_modelo", modelo: selectedModel });
    setSimRunning(true);
  }

  function handleStop() {
    sendCommand({ acao: "parar" });
    setSimRunning(false);
    setSelectedModel("");
  }

  return (
    <div className="card command-card">
      <h2>🎮 Comandos do Simulador</h2>
      <div className="command-layout">
        {/* Coluna — Modelo */}
        <div className="command-col">
          <label className="cmd-label">
            Selecionar Modelo{" "}
            {simRunning ? (
              <span style={{ color: "#22c55e", fontWeight: 600 }}>● A correr</span>
            ) : (
              <span style={{ color: "#71717a" }}>○ Idle</span>
            )}
          </label>
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={simRunning}
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
            disabled={simRunning || !selectedModel}
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
              disabled={!simRunning}
            >
              💥 Queda
            </button>
            <button
              className="cmd-btn danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "alternador" })}
              disabled={!simRunning}
            >
              🔋 Falha Alternador
            </button>
            <button
              className="cmd-btn danger"
              onClick={() => sendCommand({ acao: "evento", tipo: "sobreaquecimento" })}
              disabled={!simRunning}
            >
              🌡️ Sobreaquecimento
            </button>
            <button
              className="cmd-btn"
              onClick={() => sendCommand({ acao: "reset_eventos" })}
              disabled={!simRunning}
            >
              🔄 Reset Eventos
            </button>
            <button
              className="cmd-btn danger"
              onClick={handleStop}
              disabled={!simRunning}
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
