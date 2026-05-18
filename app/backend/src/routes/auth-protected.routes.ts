import { Router } from "express";
import { me, updateProfile, changePassword, saveResendApiKey, getResendApiKeyStatus, resendVerification } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/auth/me", authMiddleware, me);
router.put("/auth/profile", authMiddleware, updateProfile);
router.put("/auth/change-password", authMiddleware, changePassword);
router.put("/auth/resend-key", authMiddleware, saveResendApiKey);
router.get("/auth/resend-key/status", authMiddleware, getResendApiKeyStatus);
router.post("/auth/resend-verification", authMiddleware, resendVerification);

export default router;
