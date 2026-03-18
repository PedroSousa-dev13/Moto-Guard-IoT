// =============================================================================
// MotoGuard IoT — Rotas: Motorcycles
// =============================================================================

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  createMotorcycle,
  listMotorcycles,
  listProfiles,
  updateMotorcycle,
  deleteMotorcycle,
} from "../controllers/motorcycle.controller";

const router = Router();

router.post("/motorcycles", authMiddleware, createMotorcycle);
router.get("/motorcycles", authMiddleware, listMotorcycles);
router.put("/motorcycles/:id", authMiddleware, updateMotorcycle);
router.delete("/motorcycles/:id", authMiddleware, deleteMotorcycle);
router.get("/motorcycle-profiles", authMiddleware, listProfiles);

export default router;
