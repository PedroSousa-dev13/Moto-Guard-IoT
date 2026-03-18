import { useEffect, useRef, useState } from "react";
import { Activity, Clock, Database, Settings2, Wifi } from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import MapCard from "../components/MapCard";
import CommandPanel from "../components/CommandPanel";
import Toast from "../components/ui/Toast";
import type { SimulatorCommand } from "../types/telemetry";

type ToastState = { message: string; type: "success" | "error" | "info" };

export default function SimulatorContexts() {
  const {
    telemetry,
    msgCount,
    logs,
    status,
    sendCommand,
    addLog,
    devices,
    activeDeviceId,
    setActiveDeviceId,
    tripEndedSignal,
    resetSimulationView,
  } = useSocket();

  const [mapResetSignal, setMapResetSignal] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const lastToastMessageRef = useRef<string | null>(null);

  const running = status.ws && !!telemetry;
  const lastUpdate = telemetry?.system?.timestamp
    ? new Date(telemetry.system.timestamp).toLocaleTimeString("pt-PT")
    : null;

  const safeSendCommand = (cmd: SimulatorCommand) => {
    if (!status.ws) {
      const message = "Sem ligação ao servidor. Não é possível enviar comandos.";
      addLog(message, "#ef4444");
      setToast({ message, type: "error" });
      return;
    }
    sendCommand(cmd);
  };

  useEffect(() => {
    document.title = "Simulador — MotoGuard";
  }, []);

  useEffect(() => {
    if (!tripEndedSignal) return;
    setToast((prev) =>
      prev?.message === "Simulação terminada"
        ? prev
        : { message: "Simulação terminada", type: "success" },
    );
    setMapResetSignal((v) => v + 1);
    resetSimulationView();
  }, [tripEndedSignal, resetSimulationView]);

  useEffect(() => {
    const newest = logs[0];
    if (!newest) return;
    if (newest.color !== "#ef4444") return;
    if (newest.message === lastToastMessageRef.current) return;
    if (!newest.message.startsWith("Erro:")) return;

    lastToastMessageRef.current = newest.message;
    setToast({ message: newest.message, type: "error" });
  }, [logs]);

  const banner = !status.ws
    ? { type: "danger" as const, text: "Sem ligação ao servidor (WebSocket)." }
    : !status.hasData
      ? { type: "warning" as const, text: "Ligado, mas sem telemetria. Confirma o simulador." }
      : null;

  return (
    <div className="page page-full">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title">
            <Activity className="title-icon" size={24} />
            Simulador
          </div>
          <div className="page-subtitle">
            <Clock size={14} style={{ marginRight: 4 }} />
            {lastUpdate ? `Último update às ${lastUpdate}` : "A aguardar dados..."}
          </div>
        </div>

        <div className="page-actions">
          {devices.length > 1 && (
            <div className="device-selector">
              <Settings2 size={16} className="selector-icon" />
              <select
                className="control control-sm"
                value={activeDeviceId ?? ""}
                onChange={(e) => setActiveDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="status-group">
            <span
              className={`pill ${status.mqtt ? "pill-success" : "pill-danger"}`}
              title={status.mqtt ? "MQTT Conectado" : "MQTT Desconectado"}
            >
              <Wifi size={14} />
              MQTT
            </span>
            <span
              className={`pill ${status.ws ? "pill-success" : "pill-danger"}`}
              title={status.ws ? "WebSocket Conectado" : "WebSocket Desconectado"}
            >
              <Activity size={14} />
              WS
            </span>
            <span
              className={`pill ${status.hasData ? "pill-success" : "pill-warning"}`}
              title={status.hasData ? "Recebendo dados" : "Sem dados"}
            >
              <Database size={14} />
              {status.hasData ? `#${msgCount}` : "Sem dados"}
            </span>
          </div>
        </div>
      </div>

      {banner && (
        <div
          className={`sim-banner ${
            banner.type === "danger"
              ? "sim-banner-danger"
              : "sim-banner-warning"
          }`}
          role="status"
        >
          {banner.text}
        </div>
      )}

      <div className="simulator-grid">
        <div className="simulator-left">
          <MapCard
            location={telemetry?.location ?? null}
            telemetry={telemetry?.telemetry ?? null}
            imu={telemetry?.imu ?? null}
            msgCount={msgCount}
            resetSignal={mapResetSignal}
            sendCommand={safeSendCommand}
          />
        </div>

        <div className="simulator-right">
          <CommandPanel
            sendCommand={safeSendCommand}
            addLog={addLog}
            logs={logs}
            running={running}
            onStop={() => {
              setToast({ message: "Simulação terminada", type: "success" });
              setMapResetSignal((v) => v + 1);
              resetSimulationView();
            }}
          />
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => {
            setToast(null);
            lastToastMessageRef.current = null;
          }}
        />
      )}
    </div>
  );
}
