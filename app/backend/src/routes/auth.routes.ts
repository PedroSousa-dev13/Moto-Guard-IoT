// =============================================================================
// MotoGuard IoT — Rotas: Auth
// =============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, updateProfile, changePassword, saveResendApiKey, getResendApiKeyStatus, verifyEmail, resendVerification } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiadas tentativas. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/auth/register", authLimiter, register);
router.post("/auth/login", authLimiter, login);
router.get("/auth/me", authMiddleware, me);
router.put("/auth/profile", authMiddleware, updateProfile);
router.put("/auth/change-password", authMiddleware, changePassword);
router.put("/auth/resend-key", authMiddleware, saveResendApiKey);
router.get("/auth/resend-key/status", authMiddleware, getResendApiKeyStatus);
router.post("/auth/verify-email", authLimiter, verifyEmail);
router.post("/auth/resend-verification", authMiddleware, resendVerification);

export default router;
