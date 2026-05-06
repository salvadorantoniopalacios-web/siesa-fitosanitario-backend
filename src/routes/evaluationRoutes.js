import express from "express";
import multer from "multer";
import path from "path";

import {
  getEvaluations,
  createEvaluation,
  updateEvaluation,
  deleteEvaluation,
  generateEvaluationPdf,
} from "../controllers/evaluationController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const nombreArchivo = `evaluacion-${Date.now()}${extension}`;
    cb(null, nombreArchivo);
  },
});

const fileFilter = (req, file, cb) => {
  const tiposPermitidos = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

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

router.get(
  "/",
  verificarToken,
  permitirRoles("Admin", "Técnico", "Consulta"),
  getEvaluations
);

router.get(
  "/:id/pdf",
  verificarToken,
  permitirRoles("Admin", "Técnico", "Consulta"),
  generateEvaluationPdf
);

router.post(
  "/",
  verificarToken,
  permitirRoles("Admin", "Técnico"),
  upload.single("foto"),
  createEvaluation
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("Admin", "Técnico"),
  upload.single("foto"),
  updateEvaluation
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("Admin"),
  deleteEvaluation
);

export default router;