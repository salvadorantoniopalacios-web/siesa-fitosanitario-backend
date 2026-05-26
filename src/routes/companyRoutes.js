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
  permitirRoles("SuperAdmin"),
  getCompanies
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin"),
  createCompany
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin"),
  updateCompany
);

router.patch(
  "/:id/toggle-status",
  verificarToken,
  permitirRoles("SuperAdmin"),
  toggleCompanyStatus
);

export default router;