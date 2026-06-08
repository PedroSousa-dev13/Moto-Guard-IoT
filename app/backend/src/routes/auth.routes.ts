// =============================================================================
// MotoGuard IoT — Rotas: Auth
// =============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, verifyEmail } from "../controllers/auth.controller";

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
router.post("/auth/verify-email", authLimiter, verifyEmail);

export default router;
