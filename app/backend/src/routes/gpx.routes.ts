import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.middleware";
import { exportTripGpx, importGpx } from "../controllers/gpx.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadSingle = upload.single("file");

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
router.get("/gpx/export/:tripId", authMiddleware, exportTripGpx);

export default router;

