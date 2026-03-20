// =============================================================================
// MotoGuard IoT — Rotas: Auth
// =============================================================================

import { Router } from "express";
import { register, login, me, updateProfile, changePassword, saveResendApiKey, getResendApiKeyStatus } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, me);
router.put("/auth/profile", authMiddleware, updateProfile);
router.put("/auth/change-password", authMiddleware, changePassword);
router.put("/auth/resend-key", authMiddleware, saveResendApiKey);
router.get("/auth/resend-key/status", authMiddleware, getResendApiKeyStatus);

export default router;
