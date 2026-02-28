// =============================================================================
// MotoGuard IoT — Controller: Telemetry
// =============================================================================
// Endpoints relacionados com telemetria (última leitura, etc.).
// =============================================================================

import { Request, Response } from "express";
import { telemetryStore } from "../services/telemetry.store";

export function getLatestTelemetry(_req: Request, res: Response): void {
  if (!telemetryStore.latest) {
    res.status(204).json({ message: "Sem dados de telemetria ainda" });
    return;
  }

  res.json({
    received_at: new Date().toISOString(),
    total_messages: telemetryStore.count,
    data: telemetryStore.latest,
  });
}
