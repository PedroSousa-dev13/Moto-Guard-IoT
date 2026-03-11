// =============================================================================
// Header — Barra superior com logo e badges de estado
// =============================================================================

import type { ConnectionStatus } from "../types/telemetry";

interface HeaderProps {
  status: ConnectionStatus;
  msgCount: number;
}

export default function Header({ status, msgCount }: HeaderProps) {
  const mqttTooltip = status.mqtt
    ? "MQTT ligado: o backend está a comunicar com o broker e a receber/publicar tópicos."
    : "MQTT desligado: verificar docker do Mosquitto, credenciais MQTT e portas 1883/9001.";

  const wsTooltip = status.ws
    ? "WebSocket ligado: o frontend está conectado ao backend em tempo real."
    : "WebSocket desligado: verificar se o backend está a correr e se /socket.io está acessível.";

  const dataTooltip = status.hasData
    ? "Com dados: já chegou telemetria ao dashboard."
    : "Sem dados: a ligação existe, mas ainda não chegou telemetria. Verificar simulador, tópico motoguard/telemetria e estado MQTT.";

  return (
    <header className="header">
      <h1>
        🏍️ Moto<span>Guard</span> IoT — Dashboard
      </h1>
      <div className="status-badges">
        <div
          className={`badge ${status.mqtt ? "connected" : "disconnected"}`}
          title={mqttTooltip}
        >
          MQTT {status.mqtt ? "✓" : "✗"}
        </div>
        <div
          className={`badge ${status.ws ? "connected" : "disconnected"}`}
          title={wsTooltip}
        >
          WebSocket {status.ws ? "✓" : "✗"}
        </div>
        <div
          className={`badge ${status.hasData ? "connected" : "waiting"}`}
          title={dataTooltip}
        >
          {status.hasData ? `Dados ✓ #${msgCount}` : "Sem dados"}
        </div>
      </div>
    </header>
  );
}
