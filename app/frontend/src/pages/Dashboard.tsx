import React from 'react';
import { useSocket } from "../hooks/useSocket";
import GaugeCard from "../components/GaugeCard";
import TempVoltCard from "../components/TempVoltCard";
import IMUCard from "../components/IMUCard";
import MapCard from "../components/MapCard";
import StatusCard from "../components/StatusCard";
import CommandPanel from "../components/CommandPanel";

export default function Dashboard() {
  const { telemetry, msgCount, logs, status, sendCommand, addLog } = useSocket();
  const lastUpdate = telemetry?.system?.timestamp
    ? new Date(telemetry.system.timestamp).toLocaleTimeString("pt-PT")
    : null;

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
        />
        <StatusCard
          system={telemetry?.system ?? null}
          safety={telemetry?.active_safety ?? null}
          health={telemetry?.health ?? null}
          environment={telemetry?.environment ?? null}
        />

        <CommandPanel sendCommand={sendCommand} addLog={addLog} logs={logs} />
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
    </div>
  );
}
