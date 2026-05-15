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
import gpxRoutes from "./gpx.routes";
import { csrfMiddleware } from "../middleware/csrf.middleware";

const router = Router();

// Rotas públicas / auth entry-points (sem CSRF — são a porta de entrada)
router.use(healthRoutes);
router.use(authRoutes);
router.use(authResetRoutes);

// Rotas protegidas (com CSRF — já têm cookie de sessão JWT)
const protectedRouter = Router();
protectedRouter.use(csrfMiddleware);
protectedRouter.use(tripRoutes);
protectedRouter.use(telemetryRoutes);
protectedRouter.use(commandRoutes);
protectedRouter.use(motorcycleRoutes);
protectedRouter.use(gpxRoutes);
router.use(protectedRouter);

export default router;
