import { Router } from "express";
import rateLimit from "express-rate-limit";
import { forgotPassword, verifyResetToken, resetPassword } from "../controllers/auth-reset.controller";

const router = Router();

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Demasiadas tentativas. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/auth/forgot-password", resetLimiter, forgotPassword);
router.get("/auth/verify-reset-token/:token", resetLimiter, verifyResetToken);
router.post("/auth/reset-password", resetLimiter, resetPassword);

export default router;
