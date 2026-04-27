import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.middleware";
import { exportTripGpx, importGpx, parseGpxFile, saveSimulatorGpxData } from "../controllers/gpx.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Separate upload configuration for parse endpoint with 10MB limit
const parseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit as per requirements
});

const uploadSingle = upload.single("file");
const parseUploadSingle = parseUpload.single("file");

router.post("/gpx/import", authMiddleware, (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Ficheiro demasiado grande (limite 15 MB)"
          : `Erro no upload: ${err.code}`;
      res.status(400).json({ error: message });
      return;
    }

    res.status(400).json({ error: "Erro no upload do ficheiro" });
  });
}, importGpx);

// New parse endpoint for GPX upload UI
router.post("/gpx/parse", authMiddleware, (req, res, next) => {
  parseUploadSingle(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
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
}, parseGpxFile);

router.post("/gpx/simulator", authMiddleware, saveSimulatorGpxData);

router.get("/gpx/export/:tripId", authMiddleware, exportTripGpx);

export default router;
