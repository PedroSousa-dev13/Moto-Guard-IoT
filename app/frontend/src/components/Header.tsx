// =============================================================================
// Header — Barra superior com logo e badges de estado
// =============================================================================

import type { ConnectionStatus } from "../types/telemetry";

interface HeaderProps {
  status: ConnectionStatus;
  msgCount: number;
}

export default function Header({ status, msgCount }: HeaderProps) {
  return (
    <header className="header">
      <h1>
        🏍️ Moto<span>Guard</span> IoT — Dashboard
      </h1>
      <div className="status-badges">
        <div className={`badge ${status.mqtt ? "connected" : "disconnected"}`}>
          MQTT {status.mqtt ? "✓" : "✗"}
        </div>
        <div className={`badge ${status.ws ? "connected" : "disconnected"}`}>
          WebSocket {status.ws ? "✓" : "✗"}
        </div>
        <div className={`badge ${status.hasData ? "connected" : "waiting"}`}>
          {status.hasData ? `Dados ✓ #${msgCount}` : "Sem dados"}
        </div>
      </div>
    </header>
  );
}
