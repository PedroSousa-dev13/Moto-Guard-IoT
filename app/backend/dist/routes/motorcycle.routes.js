"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Motorcycles
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const motorcycle_controller_1 = require("../controllers/motorcycle.controller");
const router = (0, express_1.Router)();
router.post("/motorcycles", auth_middleware_1.authMiddleware, motorcycle_controller_1.createMotorcycle);
router.get("/motorcycles", auth_middleware_1.authMiddleware, motorcycle_controller_1.listMotorcycles);
router.get("/motorcycle-profiles", auth_middleware_1.authMiddleware, motorcycle_controller_1.listProfiles);
exports.default = router;
//# sourceMappingURL=motorcycle.routes.js.map