// =============================================================================
// MotoGuard IoT — Agregador de Rotas
// =============================================================================
// Junta todas as rotas da API sob o prefixo /api.
// =============================================================================

import { Router } from "express";
import healthRoutes from "./health.routes";
import telemetryRoutes from "./telemetry.routes";
import commandRoutes from "./command.routes";
import authRoutes from "./auth.routes";
import authResetRoutes from "./auth-reset.routes";
import tripRoutes from "./trip.routes";
import motorcycleRoutes from "./motorcycle.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(authResetRoutes);
router.use(telemetryRoutes);
router.use(commandRoutes);
router.use(tripRoutes);
router.use(motorcycleRoutes);

export default router;
