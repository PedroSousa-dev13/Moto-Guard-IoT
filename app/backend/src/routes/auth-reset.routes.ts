// =============================================================================
// MotoGuard IoT — Rotas: Auth Reset
// =============================================================================

import { Router } from "express";
import { forgotPassword, verifyResetToken, resetPassword } from "../controllers/auth-reset.controller";

const router = Router();

router.post("/auth/forgot-password", forgotPassword);
router.get("/auth/verify-reset-token/:token", verifyResetToken);
router.post("/auth/reset-password", resetPassword);

export default router;
