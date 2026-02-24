// =============================================================================
// MotoGuard IoT — App Principal (React)
// =============================================================================

import { useSocket } from "./hooks/useSocket";
import Header from "./components/Header";
import GaugeCard from "./components/GaugeCard";
import TempVoltCard from "./components/TempVoltCard";
import IMUCard from "./components/IMUCard";
import MapCard from "./components/MapCard";
import StatusCard from "./components/StatusCard";
import CommandPanel from "./components/CommandPanel";

export default function App() {
  const { telemetry, msgCount, logs, status, sendCommand, addLog } = useSocket();

  return (
    <>
      <Header status={status} msgCount={msgCount} />

      <div className="dashboard">
        {/* Linha 1 — Motor, Temp/Volt, IMU */}
        <GaugeCard data={telemetry?.telemetry ?? null} />
        <TempVoltCard
          telemetry={telemetry?.telemetry ?? null}
          health={telemetry?.health ?? null}
        />
        <IMUCard data={telemetry?.imu ?? null} />

        {/* Linha 2 — Mapa (2 cols) + Estado (1 col) */}
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

        {/* Linha 3 — Comandos (largura total) */}
        <CommandPanel sendCommand={sendCommand} addLog={addLog} logs={logs} />
      </div>

      {/* Footer com estatísticas */}
      <div className="stats-footer">
        <span>
          Mensagens: <strong>{msgCount}</strong>
        </span>
        <span>
          Último update:{" "}
          <strong>
            {telemetry?.system?.timestamp
              ? new Date(telemetry.system.timestamp).toLocaleTimeString("pt-PT")
              : "—"}
          </strong>
        </span>
      </div>
    </>
  );
}
