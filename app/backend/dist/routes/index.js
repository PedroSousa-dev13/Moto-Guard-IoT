"use strict";
// =============================================================================
// MotoGuard IoT — Agregador de Rotas
// =============================================================================
// Junta todas as rotas da API sob o prefixo /api.
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_routes_1 = __importDefault(require("./health.routes"));
const telemetry_routes_1 = __importDefault(require("./telemetry.routes"));
const command_routes_1 = __importDefault(require("./command.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const auth_reset_routes_1 = __importDefault(require("./auth-reset.routes"));
const trip_routes_1 = __importDefault(require("./trip.routes"));
const motorcycle_routes_1 = __importDefault(require("./motorcycle.routes"));
const router = (0, express_1.Router)();
router.use(health_routes_1.default);
router.use(auth_routes_1.default);
router.use(auth_reset_routes_1.default);
router.use(telemetry_routes_1.default);
router.use(command_routes_1.default);
router.use(trip_routes_1.default);
router.use(motorcycle_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map