// =============================================================================
// MotoGuard IoT — Rotas: Motorcycles
// =============================================================================

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  createMotorcycle,
  listMotorcycles,
  listProfiles,
} from "../controllers/motorcycle.controller";

const router = Router();

router.post("/motorcycles", authMiddleware, createMotorcycle);
router.get("/motorcycles", authMiddleware, listMotorcycles);
router.get("/motorcycle-profiles", authMiddleware, listProfiles);

export default router;
