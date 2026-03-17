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
const uploadSingle = upload.single("file");
router.post("/gpx/import", auth_middleware_1.authMiddleware, (req, res, next) => {
    uploadSingle(req, res, (err) => {
        if (!err) {
            next();
            return;
        }
        if (err instanceof multer_1.default.MulterError) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "Ficheiro demasiado grande (limite 15 MB)"
                : `Erro no upload: ${err.code}`;
            res.status(400).json({ error: message });
            return;
        }
        res.status(400).json({ error: "Erro no upload do ficheiro" });
    });
}, gpx_controller_1.importGpx);
router.get("/gpx/export/:tripId", auth_middleware_1.authMiddleware, gpx_controller_1.exportTripGpx);
exports.default = router;
//# sourceMappingURL=gpx.routes.js.map