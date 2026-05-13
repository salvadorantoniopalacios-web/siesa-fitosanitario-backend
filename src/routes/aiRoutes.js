import express from "express";
import multer from "multer";
import { analizarImagenFitosanitaria } from "../controllers/aiController.js";
import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ];

  if (tiposPermitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/analizar",
  verificarToken,
  permitirRoles("Admin", "Técnico", "Consulta"),
  upload.single("foto"),
  analizarImagenFitosanitaria
);

export default router;