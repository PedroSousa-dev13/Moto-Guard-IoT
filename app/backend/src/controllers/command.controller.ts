// =============================================================================
// MotoGuard IoT — Controller: Command
// =============================================================================
// Endpoint para enviar comandos ao simulador via MQTT.
// =============================================================================

import { Request, Response } from "express";
import { mqttService } from "../services/mqtt.service";
import type { SimulatorCommand } from "../models/telemetry.model";

export function sendCommand(req: Request, res: Response): void {
  const command: SimulatorCommand = req.body;

  if (!command || !command.acao) {
    res.status(400).json({ error: "Campo 'acao' é obrigatório" });
    return;
  }

  if (!mqttService.connected) {
    res.status(503).json({ error: "MQTT não está conectado" });
    return;
  }

  const sent = mqttService.publishCommand(command);
  if (!sent) {
    res.status(503).json({ error: "Falha ao publicar comando no MQTT" });
    return;
  }

  console.log("Comando enviado via REST:", JSON.stringify(command));
  res.json({ status: "sent", command });
}
