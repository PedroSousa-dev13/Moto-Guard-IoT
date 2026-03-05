"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Telemetry
// =============================================================================
// Endpoints relacionados com telemetria (última leitura, etc.).
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestTelemetry = getLatestTelemetry;
const telemetry_store_1 = require("../services/telemetry.store");
function getLatestTelemetry(_req, res) {
    if (!telemetry_store_1.telemetryStore.latest) {
        res.status(204).json({ message: "Sem dados de telemetria ainda" });
        return;
    }
    res.json({
        received_at: new Date().toISOString(),
        total_messages: telemetry_store_1.telemetryStore.count,
        data: telemetry_store_1.telemetryStore.latest,
    });
}
//# sourceMappingURL=telemetry.controller.js.map