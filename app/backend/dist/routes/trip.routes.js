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
router.get("/trips/feed", auth_middleware_1.authMiddleware, trip_controller_1.listTripFeed);
router.get("/trips/:id", auth_middleware_1.authMiddleware, trip_controller_1.getTrip);
router.get("/trips/:id/evaluation", auth_middleware_1.authMiddleware, trip_controller_1.getTripEvaluation);
router.post("/trips/:id/categorize", auth_middleware_1.authMiddleware, trip_controller_1.categorizeTripHandler);
router.get("/ml/status", auth_middleware_1.authMiddleware, trip_controller_1.getMlStatusHandler);
router.get("/alerts", auth_middleware_1.authMiddleware, trip_controller_1.listAlerts);
exports.default = router;
//# sourceMappingURL=trip.routes.js.map