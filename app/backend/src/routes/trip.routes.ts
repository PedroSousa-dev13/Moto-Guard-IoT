// =============================================================================
// MotoGuard IoT — Rotas: Trips
// =============================================================================

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { listTrips, listTripFeed, getTrip, getTripEvaluation, getMlStatusHandler, listAlerts, categorizeTripHandler } from "../controllers/trip.controller";

const router = Router();

router.get("/trips", authMiddleware, listTrips);
router.get("/trips/feed", authMiddleware, listTripFeed);
router.get("/trips/:id", authMiddleware, getTrip);
router.get("/trips/:id/evaluation", authMiddleware, getTripEvaluation);
router.post("/trips/:id/categorize", authMiddleware, categorizeTripHandler);
router.get("/ml/status", authMiddleware, getMlStatusHandler);
router.get("/alerts", authMiddleware, listAlerts);

export default router;
