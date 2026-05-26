import express from "express";

import {
  getLots,
  createLot,
  updateLot,
  deleteLot,
} from "../controllers/lotController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getLots
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  createLot
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  updateLot
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  deleteLot
);

export default router;