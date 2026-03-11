// =============================================================================
// MotoGuard IoT — Controller: Health
// =============================================================================
// Endpoint de health check — retorna estado geral do backend.
// =============================================================================

import { Request, Response } from "express";
import { env } from "../config/env";
import { mqttService } from "../services/mqtt.service";
import { telemetryStore } from "../services/telemetry.store";
import { socketService } from "../services/socket.service";

export function getHealth(_req: Request, res: Response): void {
  res.json({
    status: "ok",
    service: "motoguard-backend",
    timestamp: new Date().toISOString(),
    mqtt: {
      connected: mqttService.connected,
      broker: env.MQTT_BROKER_URL,
      topic: env.MQTT_TOPIC_TELEMETRIA,
    },
    stats: {
      telemetryCount: telemetryStore.count,
      connectedClients: socketService.connectedClients,
      hasData: telemetryStore.hasData,
    },
    infrastructure: {
      influxdb: env.INFLUXDB_URL,
      postgres: env.DATABASE_URL ? "configured" : "not configured",
    },
  });
}
