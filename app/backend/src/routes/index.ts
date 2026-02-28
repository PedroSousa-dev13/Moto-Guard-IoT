// =============================================================================
// MotoGuard IoT — Agregador de Rotas
// =============================================================================
// Junta todas as rotas da API sob o prefixo /api.
// =============================================================================

import { Router } from "express";
import healthRoutes from "./health.routes";
import telemetryRoutes from "./telemetry.routes";
import commandRoutes from "./command.routes";

const router = Router();

router.use(healthRoutes);
router.use(telemetryRoutes);
router.use(commandRoutes);

export default router;
