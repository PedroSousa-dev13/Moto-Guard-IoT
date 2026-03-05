"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Command
// =============================================================================
// Endpoint para enviar comandos ao simulador via MQTT.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCommand = sendCommand;
const mqtt_service_1 = require("../services/mqtt.service");
function sendCommand(req, res) {
    const command = req.body;
    if (!command || !command.acao) {
        res.status(400).json({ error: "Campo 'acao' é obrigatório" });
        return;
    }
    if (!mqtt_service_1.mqttService.connected) {
        res.status(503).json({ error: "MQTT não está conectado" });
        return;
    }
    mqtt_service_1.mqttService.publishCommand(command);
    console.log("📤 Comando enviado via REST:", JSON.stringify(command));
    res.json({ status: "sent", command });
}
//# sourceMappingURL=command.controller.js.map