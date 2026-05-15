import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { authMiddleware } from "../middleware/auth.middleware";
import { exportTripGpx, importGpx, parseGpxFile, saveSimulatorGpxData } from "../controllers/gpx.controller";

const TMP_DIR = path.resolve(__dirname, "..", "..", "..", "tmp", "uploads");
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".gpx";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const router = Router();

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Separate upload configuration for parse endpoint with 10MB limit
const parseUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadSingle = upload.single("file");
const parseUploadSingle = parseUpload.single("file");

// Middleware de limpeza: apaga o ficheiro temporário após a resposta ser enviada
function cleanupTempFile(req: Request, _res: Response, next: NextFunction): void {
  next();
  if (req.file?.path) {
    const filePath = req.file.path;
    setImmediate(() => {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error(`[gpx] Erro ao limpar ficheiro temporário ${filePath}:`, err.message);
        }
      });
    });
  }
}

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
}, importGpx, cleanupTempFile);

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
          ? "Ficheiro demasiado grande (limite 10 MB)"
          : `Erro no upload: ${err.code}`;
      res.status(413).json({ 
        success: false, 
        error: message,
        validationErrors: [message]
      });
      return;
    }

    res.status(400).json({ 
      success: false, 
      error: "Erro no upload do ficheiro",
      validationErrors: ["Falha ao processar ficheiro enviado"]
    });
  });
}, parseGpxFile, cleanupTempFile);

router.post("/gpx/simulator", authMiddleware, saveSimulatorGpxData);

router.get("/gpx/export/:tripId", authMiddleware, exportTripGpx);

export default router;
