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

console.log("📁 Evaluaciones guardarán fotos en:", uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Carpeta uploads creada:", uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📥 Multer recibió archivo:");
    console.log("Campo:", file.fieldname);
    console.log("Nombre original:", file.originalname);
    console.log("Tipo:", file.mimetype);
    console.log("Destino:", uploadsDir);

    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const nombreArchivo = `evaluacion-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    console.log("📝 Nombre generado para guardar:", nombreArchivo);

    cb(null, nombreArchivo);
  },
});

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

    next();
  });
};

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
  manejarUploadEvaluacion,
  createEvaluation
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("Admin", "Técnico"),
  manejarUploadEvaluacion,
  updateEvaluation
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("Admin"),
  deleteEvaluation
);

export default router;