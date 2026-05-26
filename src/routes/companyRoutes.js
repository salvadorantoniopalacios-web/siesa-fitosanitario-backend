import express from "express";
import multer from "multer";

import {
  getCompanies,
  createCompany,
  updateCompany,
  toggleCompanyStatus,
} from "../controllers/companyController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const storage = multer.memoryStorage();

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

router.get("/", verificarToken, permitirRoles("SuperAdmin"), getCompanies);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin"),
  upload.single("logo"),
  createCompany
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin"),
  upload.single("logo"),
  updateCompany
);

router.patch(
  "/:id/toggle-status",
  verificarToken,
  permitirRoles("SuperAdmin"),
  toggleCompanyStatus
);

export default router;