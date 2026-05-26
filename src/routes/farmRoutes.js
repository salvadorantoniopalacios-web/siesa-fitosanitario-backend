import express from "express";

import {
  getFarms,
  createFarm,
  updateFarm,
  deleteFarm,
} from "../controllers/farmController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getFarms
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  createFarm
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  updateFarm
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  deleteFarm
);

export default router;