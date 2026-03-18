import React, { useEffect, useState } from 'react';
import { useSocket } from "../hooks/useSocket";
import GaugeCard from "../components/GaugeCard";
import TempVoltCard from "../components/TempVoltCard";
import IMUCard from "../components/IMUCard";
import MapCard from "../components/MapCard";
import StatusCard from "../components/StatusCard";
import CommandPanel from "../components/CommandPanel";
import Toast from "../components/ui/Toast";

export default function Dashboard() {
  const { telemetry, msgCount, logs, status, sendCommand, addLog, devices, activeDeviceId, setActiveDeviceId, tripEndedSignal, resetSimulationView } = useSocket();
  const lastUpdate = telemetry?.system?.timestamp
    ? new Date(telemetry.system.timestamp).toLocaleTimeString("pt-PT")
    : null;
  const [mapResetSignal, setMapResetSignal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const running = status.ws && !!telemetry;

  useEffect(() => {
    if (!tripEndedSignal) return;
    setToast((prev) =>
      prev?.message === "Simulação terminada"
        ? prev
        : { message: "Simulação terminada", type: "success" }
    );
    setMapResetSignal((v) => v + 1);
    resetSimulationView();
  }, [tripEndedSignal, resetSimulationView]);

  return (
    <div className="page page-full">
      <div className="page-header">
        <div>
          <div className="page-title">📊 Dashboard</div>
          <div className="page-subtitle">
            {lastUpdate ? `Último update às ${lastUpdate}` : "A aguardar dados..."}
          </div>
        </div>
        <div className="page-actions">
          {devices.length > 1 && (
            <>
              <span className="field-label" style={{ marginTop: 10 }}>
                Dispositivo
              </span>
              <select
                className="control control-sm"
                value={activeDeviceId ?? ""}
                onChange={(e) => setActiveDeviceId(e.target.value)}
                style={{ width: 220 }}
              >
                {devices.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </>
          )}
          <span
            className={`pill ${status.mqtt ? "pill-success" : "pill-danger"}`}
            title={
              status.mqtt
                ? "MQTT ligado: o backend está a comunicar com o broker e a receber/publicar tópicos."
                : "MQTT desligado: verificar docker do Mosquitto, credenciais MQTT e portas 1883/9001."
            }
          >
            MQTT {status.mqtt ? "✓" : "✗"}
          </span>
          <span
            className={`pill ${status.ws ? "pill-success" : "pill-danger"}`}
            title={
              status.ws
                ? "WebSocket ligado: o frontend está conectado ao backend em tempo real."
                : "WebSocket desligado: verificar se o backend está a correr e se /socket.io está acessível."
            }
          >
            WebSocket {status.ws ? "✓" : "✗"}
          </span>
          <span
            className={`pill ${status.hasData ? "pill-success" : "pill-warning"}`}
            title={
              status.hasData
                ? "Com dados: já chegou telemetria ao dashboard."
                : "Sem dados: a ligação existe, mas ainda não chegou telemetria. Verificar simulador, tópico motoguard/telemetria e estado MQTT."
            }
          >
            {status.hasData ? `Dados ✓ #${msgCount}` : "Sem dados"}
          </span>
        </div>
      </div>

      <div className="dashboard">
        <GaugeCard data={telemetry?.telemetry ?? null} />
        <TempVoltCard
          telemetry={telemetry?.telemetry ?? null}
          health={telemetry?.health ?? null}
        />
        <IMUCard data={telemetry?.imu ?? null} />

        <MapCard
          location={telemetry?.location ?? null}
          telemetry={telemetry?.telemetry ?? null}
          msgCount={msgCount}
          resetSignal={mapResetSignal}
          sendCommand={sendCommand}
        />
        <StatusCard
          system={telemetry?.system ?? null}
          safety={telemetry?.active_safety ?? null}
          health={telemetry?.health ?? null}
          environment={telemetry?.environment ?? null}
        />

        <CommandPanel
          sendCommand={sendCommand}
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

      <div className="stats-footer">
        <span>
          Mensagens: <strong>{msgCount}</strong>
        </span>
        <span>
          Último update:{" "}
          <strong>
            {lastUpdate ?? "—"}
          </strong>
        </span>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
