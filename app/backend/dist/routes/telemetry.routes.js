"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Telemetry
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const telemetry_controller_1 = require("../controllers/telemetry.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get("/telemetry/latest", auth_middleware_1.authMiddleware, telemetry_controller_1.getLatestTelemetry);
router.get("/telemetry/:tripId", auth_middleware_1.authMiddleware, telemetry_controller_1.getTripTelemetry);
exports.default = router;
//# sourceMappingURL=telemetry.routes.js.map