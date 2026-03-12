"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Auth Reset
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_reset_controller_1 = require("../controllers/auth-reset.controller");
const router = (0, express_1.Router)();
router.post("/auth/forgot-password", auth_reset_controller_1.forgotPassword);
router.get("/auth/verify-reset-token/:token", auth_reset_controller_1.verifyResetToken);
router.post("/auth/reset-password", auth_reset_controller_1.resetPassword);
exports.default = router;
//# sourceMappingURL=auth-reset.routes.js.map