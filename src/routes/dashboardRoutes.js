import express from "express";

import {
  getDashboardSummary,
  generateDashboardPdf,
} from "../controllers/dashboardController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/summary",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getDashboardSummary
);

router.get(
  "/report/pdf",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  generateDashboardPdf
);

export default router;