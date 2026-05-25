import express from "express";

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

router.get(
  "/",
  verificarToken,
  permitirRoles("Admin"),
  getCompanies
);

router.post(
  "/",
  verificarToken,
  permitirRoles("Admin"),
  createCompany
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("Admin"),
  updateCompany
);

router.patch(
  "/:id/toggle-status",
  verificarToken,
  permitirRoles("Admin"),
  toggleCompanyStatus
);

export default router;