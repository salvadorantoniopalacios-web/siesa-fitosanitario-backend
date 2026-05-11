import express from "express";
import { verificarToken } from "../middleware/authMiddleware.js";
import {
  getCrops,
  createCrop,
  updateCrop,
  deleteCrop,
  getPests,
  getPestsByCrop,
  createPest,
  updatePest,
  deletePest,
} from "../controllers/catalogController.js";

const router = express.Router();

router.get("/crops", verificarToken, getCrops);
router.post("/crops", verificarToken, createCrop);
router.put("/crops/:id", verificarToken, updateCrop);
router.delete("/crops/:id", verificarToken, deleteCrop);

router.get("/pests", verificarToken, getPests);
router.get("/pests/crop/:crop_id", verificarToken, getPestsByCrop);
router.post("/pests", verificarToken, createPest);
router.put("/pests/:id", verificarToken, updatePest);
router.delete("/pests/:id", verificarToken, deletePest);

export default router;