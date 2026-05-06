import express from "express";

import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} from "../controllers/userController.js";

import {
  verificarToken,
  permitirRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  verificarToken,
  permitirRoles("admin", "Admin"),
  getUsers
);

router.post(
  "/",
  verificarToken,
  permitirRoles("admin", "Admin"),
  createUser
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("admin", "Admin"),
  updateUser
);

router.patch(
  "/:id/toggle-status",
  verificarToken,
  permitirRoles("admin", "Admin"),
  toggleUserStatus
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("admin", "Admin"),
  deleteUser
);

export default router;