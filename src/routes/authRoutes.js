import express from "express";
import { login } from "../controllers/authController.js";
import { verificarToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);

router.get("/me", verificarToken, (req, res) => {
  res.json({
    mensaje: "Usuario autenticado correctamente",
    usuario: req.usuario,
  });
});

export default router;