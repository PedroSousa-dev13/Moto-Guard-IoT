// =============================================================================
// MotoGuard IoT — Rotas: Command
// =============================================================================

import { Router } from "express";
import { sendCommand } from "../controllers/command.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/command", authMiddleware, sendCommand);

export default router;
