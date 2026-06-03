import express from "express";

import {
  getInventoryProducts,
  createInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
  getInventoryBatches,
  createInventoryBatch,
  getInventoryMovements,
} from "../controllers/inventoryController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
========================================
PRODUCTOS INVENTARIO
========================================
*/

router.get(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getInventoryProducts
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  createInventoryProduct
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  updateInventoryProduct
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  deleteInventoryProduct
);

/*
========================================
LOTES INVENTARIO
========================================
*/

router.get(
  "/:productId/batches",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getInventoryBatches
);

router.post(
  "/:productId/batches",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico"),
  createInventoryBatch
);

/*
========================================
MOVIMIENTOS INVENTARIO
========================================
*/

router.get(
  "/:productId/movements",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin", "Técnico", "Consulta"),
  getInventoryMovements
);

export default router;