import express from "express";
import { getAlerts } from "../controllers/alertController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  verificarToken,
  permitirRoles("Admin", "Técnico", "Consulta"),
  getAlerts
);

export default router;