"use strict";
// =============================================================================
// MotoGuard IoT — Rotas: Command
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const command_controller_1 = require("../controllers/command.controller");
const router = (0, express_1.Router)();
router.post("/command", command_controller_1.sendCommand);
exports.default = router;
//# sourceMappingURL=command.routes.js.map