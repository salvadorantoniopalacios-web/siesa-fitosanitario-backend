import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/summary",
  verificarToken,
  permitirRoles("Admin", "Técnico", "Consulta"),
  getDashboardSummary
);

export default router;