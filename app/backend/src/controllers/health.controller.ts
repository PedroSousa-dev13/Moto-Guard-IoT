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
    },
    stats: {
      telemetryCount: telemetryStore.count,
      connectedClients: socketService.connectedClients,
      hasData: telemetryStore.hasData,
    },
    infrastructure: {
      influxdb: "available",
      postgres: "configured",
    },
  });
}
