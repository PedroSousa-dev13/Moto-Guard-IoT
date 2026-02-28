// =============================================================================
// MotoGuard IoT — Rotas: Command
// =============================================================================

import { Router } from "express";
import { sendCommand } from "../controllers/command.controller";

const router = Router();

router.post("/command", sendCommand);

export default router;
