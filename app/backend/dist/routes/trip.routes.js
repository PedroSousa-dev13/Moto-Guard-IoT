"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Trips
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const trip_controller_1 = require("../controllers/trip.controller");
const router = (0, express_1.Router)();
router.get("/trips", auth_middleware_1.authMiddleware, trip_controller_1.listTrips);
router.get("/trips/:id", auth_middleware_1.authMiddleware, trip_controller_1.getTrip);
router.get("/trips/:id/evaluation", auth_middleware_1.authMiddleware, trip_controller_1.getTripEvaluation);
exports.default = router;
//# sourceMappingURL=trip.routes.js.map