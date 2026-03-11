// =============================================================================
// MotoGuard IoT — Rotas: Trips
// =============================================================================

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { listTrips, getTrip } from "../controllers/trip.controller";

const router = Router();

router.get("/trips", authMiddleware, listTrips);
router.get("/trips/:id", authMiddleware, getTrip);

export default router;
