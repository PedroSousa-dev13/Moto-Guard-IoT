"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const gpx_controller_1 = require("../controllers/gpx.controller");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
});
router.post("/gpx/import", auth_middleware_1.authMiddleware, upload.single("file"), gpx_controller_1.importGpx);
exports.default = router;
//# sourceMappingURL=gpx.routes.js.map