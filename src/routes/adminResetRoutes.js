import express from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const router = express.Router();

router.get("/reset-admin", async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash("Siesa2026*", 10);

    const result = await pool.query(
      `UPDATE users 
       SET password = $1, nombre = $2, rol = $3
       WHERE email = $4
       RETURNING id, nombre, email, rol`,
      [passwordHash, "Administrador SIESA", "admin", "admin@siesa.com"]
    );

    res.json({
      mensaje: "Contraseña admin actualizada correctamente",
      usuario: result.rows[0],
      acceso: {
        email: "admin@siesa.com",
        password: "Siesa2026*"
      }
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error actualizando admin",
      error: error.message
    });
  }
});

export default router;