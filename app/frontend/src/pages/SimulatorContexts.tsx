import React, { useEffect, useState } from 'react';
import { useSocket } from "../hooks/useSocket";
import GaugeCard from "../components/GaugeCard";
import TempVoltCard from "../components/TempVoltCard";
import IMUCard from "../components/IMUCard";
import MapCard from "../components/MapCard";
import StatusCard from "../components/StatusCard";
import CommandPanel from "../components/CommandPanel";
import MotorcycleDigitalTwin from "../components/product/MotorcycleDigitalTwin";
import Toast from "../components/ui/Toast";
import { Activity, Wifi, Database, Clock, Settings2 } from 'lucide-react';

export default function SimulatorContexts() {
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
        <div className="header-main">
          <div className="page-title">
            <Activity className="title-icon" size={24} />
            Dashboard
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

      <div className="dashboard">
        <div className="hero-row">
          <div className="twin-card-container">
            <MotorcycleDigitalTwin data={telemetry} />
          </div>
          <div className="map-card-container">
            <MapCard
              location={telemetry?.location ?? null}
              telemetry={telemetry?.telemetry ?? null}
              imu={telemetry?.imu ?? null}
              msgCount={msgCount}
              resetSignal={mapResetSignal}
              sendCommand={sendCommand}
            />
          </div>
        </div>

        <div className="data-hub-grid">
          <GaugeCard data={telemetry?.telemetry ?? null} />
          <TempVoltCard
            telemetry={telemetry?.telemetry ?? null}
            health={telemetry?.health ?? null}
          />
          <IMUCard data={telemetry?.imu ?? null} />
          <StatusCard
            system={telemetry?.system ?? null}
            safety={telemetry?.active_safety ?? null}
            health={telemetry?.health ?? null}
            environment={telemetry?.environment ?? null}
          />
        </div>

        <div className="command-card-full">
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
