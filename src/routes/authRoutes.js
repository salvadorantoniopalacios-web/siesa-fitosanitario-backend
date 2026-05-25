import express from "express";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

import { login } from "../controllers/authController.js";
import { verificarToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);

/*
========================================
CAMBIAR EMPRESA ACTIVA
========================================
*/
router.post("/switch-company", verificarToken, async (req, res) => {
  try {
    const { company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({
        mensaje: "Debe enviar company_id",
      });
    }

    /*
    ========================================
    VALIDAR QUE EL USUARIO TENGA ACCESO
    ========================================
    */

    const acceso = await pool.query(
      `
      SELECT 
        companies.id,
        companies.nombre
      FROM user_companies
      INNER JOIN companies
        ON companies.id = user_companies.company_id
      WHERE user_companies.user_id = $1
      AND user_companies.company_id = $2
      AND companies.activo = true
      `,
      [req.usuario.id, company_id]
    );

    if (acceso.rows.length === 0) {
      return res.status(403).json({
        mensaje: "No tiene acceso a esta empresa",
      });
    }

    /*
    ========================================
    OBTENER USUARIO ACTUAL
    ========================================
    */

    const userResult = await pool.query(
      `
      SELECT *
      FROM users
      WHERE id = $1
      `,
      [req.usuario.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    const user = userResult.rows[0];

    /*
    ========================================
    OBTENER TODAS LAS EMPRESAS
    ========================================
    */

    const empresasResult = await pool.query(
      `
      SELECT 
        companies.id,
        companies.nombre
      FROM user_companies
      INNER JOIN companies
        ON companies.id = user_companies.company_id
      WHERE user_companies.user_id = $1
      AND companies.activo = true
      ORDER BY companies.nombre ASC
      `,
      [user.id]
    );

    /*
    ========================================
    CREAR NUEVO TOKEN
    ========================================
    */

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        company_id: Number(company_id),
        empresa: acceso.rows[0].nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      mensaje: "Empresa cambiada correctamente",
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        company_id: Number(company_id),
        empresa: acceso.rows[0].nombre,
        empresas_disponibles: empresasResult.rows,
      },
    });
  } catch (error) {
    console.error("ERROR SWITCH COMPANY:", error);

    res.status(500).json({
      mensaje: "Error cambiando empresa",
      error: error.message,
    });
  }
});

router.get("/me", verificarToken, (req, res) => {
  res.json({
    mensaje: "Usuario autenticado correctamente",
    usuario: req.usuario,
  });
});

export default router;