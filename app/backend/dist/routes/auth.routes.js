"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Auth
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/auth/register", auth_controller_1.register);
router.post("/auth/login", auth_controller_1.login);
router.get("/auth/me", auth_middleware_1.authMiddleware, auth_controller_1.me);
router.put("/auth/profile", auth_middleware_1.authMiddleware, auth_controller_1.updateProfile);
router.put("/auth/change-password", auth_middleware_1.authMiddleware, auth_controller_1.changePassword);
router.put("/auth/resend-key", auth_middleware_1.authMiddleware, auth_controller_1.saveResendApiKey);
router.get("/auth/resend-key/status", auth_middleware_1.authMiddleware, auth_controller_1.getResendApiKeyStatus);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map