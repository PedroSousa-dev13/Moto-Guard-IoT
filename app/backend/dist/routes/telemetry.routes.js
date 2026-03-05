"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Telemetry
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const telemetry_controller_1 = require("../controllers/telemetry.controller");
const router = (0, express_1.Router)();
router.get("/telemetry/latest", telemetry_controller_1.getLatestTelemetry);
exports.default = router;
//# sourceMappingURL=telemetry.routes.js.map