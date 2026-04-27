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
// Separate upload configuration for parse endpoint with 10MB limit
const parseUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit as per requirements
});
const uploadSingle = upload.single("file");
const parseUploadSingle = parseUpload.single("file");
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
// New parse endpoint for GPX upload UI
router.post("/gpx/parse", auth_middleware_1.authMiddleware, (req, res, next) => {
    parseUploadSingle(req, res, (err) => {
        if (!err) {
            next();
            return;
        }
        if (err instanceof multer_1.default.MulterError) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "File size exceeds 10MB limit"
                : `Upload error: ${err.code}`;
            res.status(413).json({
                success: false,
                error: message,
                validationErrors: [message]
            });
            return;
        }
        res.status(400).json({
            success: false,
            error: "File upload error",
            validationErrors: ["Failed to process uploaded file"]
        });
    });
}, gpx_controller_1.parseGpxFile);
router.post("/gpx/simulator", auth_middleware_1.authMiddleware, gpx_controller_1.saveSimulatorGpxData);
router.get("/gpx/export/:tripId", auth_middleware_1.authMiddleware, gpx_controller_1.exportTripGpx);
exports.default = router;
//# sourceMappingURL=gpx.routes.js.map