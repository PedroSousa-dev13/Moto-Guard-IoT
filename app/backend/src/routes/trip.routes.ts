// =============================================================================
// MotoGuard IoT — Rotas: Trips
// =============================================================================

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { listTrips, getTrip, getTripEvaluation } from "../controllers/trip.controller";

const router = Router();

router.get("/trips", authMiddleware, listTrips);
router.get("/trips/:id", authMiddleware, getTrip);
router.get("/trips/:id/evaluation", authMiddleware, getTripEvaluation);

export default router;
