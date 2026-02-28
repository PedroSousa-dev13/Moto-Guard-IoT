// =============================================================================
// MotoGuard IoT — Rotas: Telemetry
// =============================================================================

import { Router } from "express";
import { getLatestTelemetry } from "../controllers/telemetry.controller";

const router = Router();

router.get("/telemetry/latest", getLatestTelemetry);

export default router;
