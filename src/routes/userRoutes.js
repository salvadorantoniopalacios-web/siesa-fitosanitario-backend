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
  permitirRoles("SuperAdmin", "Admin"),
  getUsers
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  createUser
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  updateUser
);

router.patch(
  "/:id/toggle-status",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  toggleUserStatus
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("SuperAdmin", "Admin"),
  deleteUser
);

export default router;