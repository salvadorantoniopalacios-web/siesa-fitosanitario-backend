import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

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

const uploadsDir = path.join(process.cwd(), "uploads");

console.log("📁 Carpeta local uploads disponible como respaldo:", uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Carpeta uploads creada:", uploadsDir);
}

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

const uploadEvaluacion = upload.fields([
  { name: "foto", maxCount: 1 },
  { name: "fotos_plagas", maxCount: 20 },
]);

const manejarUploadEvaluacion = (req, res, next) => {
  uploadEvaluacion(req, res, (error) => {
    if (error) {
      console.error("❌ Error en multer:", error.message);

      return res.status(400).json({
        mensaje: "Error al subir la imagen",
        error: error.message,
      });
    }

    console.log("✅ req.files recibido por backend:");
    console.log(req.files);

    console.log("✅ req.body recibido por backend:");
    console.log(req.body);

    if (req.files?.foto?.[0]) {
      console.log("📥 Foto general recibida:");
      console.log("Campo:", req.files.foto[0].fieldname);
      console.log("Nombre original:", req.files.foto[0].originalname);
      console.log("Tipo:", req.files.foto[0].mimetype);
      console.log("Tamaño:", req.files.foto[0].size);
    }

    if (req.files?.fotos_plagas?.length > 0) {
      console.log("📥 Fotos de plagas recibidas:", req.files.fotos_plagas.length);
    }

    next();
  });
};

router.get(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getEvaluations
);

router.get(
  "/:id/pdf",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  generateEvaluationPdf
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  manejarUploadEvaluacion,
  createEvaluation
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  manejarUploadEvaluacion,
  updateEvaluation
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  deleteEvaluation
);

export default router;