import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      `
      SELECT 
        users.*,
        companies.nombre AS empresa,
        companies.activo AS empresa_activa
      FROM users
      LEFT JOIN companies ON companies.id = users.company_id
      WHERE users.email = $1
      `,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        mensaje: "Usuario o contraseña incorrectos",
      });
    }

    const user = userResult.rows[0];

    if (user.activo === false) {
      return res.status(403).json({
        mensaje: "Usuario inactivo. Contacte al administrador.",
      });
    }

    if (user.empresa_activa === false) {
      return res.status(403).json({
        mensaje: "Empresa inactiva. Contacte al administrador.",
      });
    }

    const passwordCorrecto = await bcrypt.compare(password, user.password);

    if (!passwordCorrecto) {
      return res.status(401).json({
        mensaje: "Usuario o contraseña incorrectos",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        company_id: user.company_id,
        empresa: user.empresa,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      mensaje: "Login correcto",
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        company_id: user.company_id,
        empresa: user.empresa,
      },
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error en login",
      error: error.message,
    });
  }
};