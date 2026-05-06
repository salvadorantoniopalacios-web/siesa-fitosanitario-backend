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
  permitirRoles("Admin"),
  getUsers
);

router.post(
  "/",
  verificarToken,
  permitirRoles("Admin"),
  createUser
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("Admin"),
  updateUser
);

router.patch(
  "/:id/toggle-status",
  verificarToken,
  permitirRoles("Admin"),
  toggleUserStatus
);

router.delete(
  "/:id",
  verificarToken,
  permitirRoles("Admin"),
  deleteUser
);

export default router;