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

router.get("/", verificarToken, permitirRoles("Admin", "Técnico", "Consulta"), getFarms);
router.post("/", verificarToken, permitirRoles("Admin", "Técnico"), createFarm);
router.put("/:id", verificarToken, permitirRoles("Admin", "Técnico"), updateFarm);
router.delete("/:id", verificarToken, permitirRoles("Admin"), deleteFarm);

export default router;