"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Health
// =============================================================================
// Endpoint de health check — retorna estado geral do backend.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = getHealth;
const env_1 = require("../config/env");
const mqtt_service_1 = require("../services/mqtt.service");
const telemetry_store_1 = require("../services/telemetry.store");
const socket_service_1 = require("../services/socket.service");
function getHealth(_req, res) {
    res.json({
        status: "ok",
        service: "motoguard-backend",
        timestamp: new Date().toISOString(),
        mqtt: {
            connected: mqtt_service_1.mqttService.connected,
            broker: env_1.env.MQTT_BROKER_URL,
            topic: env_1.env.MQTT_TOPIC_TELEMETRIA,
        },
        stats: {
            telemetryCount: telemetry_store_1.telemetryStore.count,
            connectedClients: socket_service_1.socketService.connectedClients,
            hasData: telemetry_store_1.telemetryStore.hasData,
        },
        infrastructure: {
            influxdb: env_1.env.INFLUXDB_URL,
            postgres: env_1.env.DATABASE_URL ? "configured" : "not configured",
        },
    });
}
//# sourceMappingURL=health.controller.js.map