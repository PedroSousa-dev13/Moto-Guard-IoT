// =============================================================================
// MotoGuard IoT — Rotas: Telemetry
// =============================================================================

import { Router } from "express";
import { getLatestTelemetry, getTripTelemetry } from "../controllers/telemetry.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/telemetry/latest", authMiddleware, getLatestTelemetry);
router.get("/telemetry/:tripId", authMiddleware, getTripTelemetry);

export default router;
