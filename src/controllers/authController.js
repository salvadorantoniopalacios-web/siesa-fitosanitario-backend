import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const login = async (req, res) => {
  try {
    const { email, password, company_id } = req.body;

    const userResult = await pool.query(
      `
      SELECT *
      FROM users
      WHERE email = $1
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

    const passwordCorrecto = await bcrypt.compare(password, user.password);

    if (!passwordCorrecto) {
      return res.status(401).json({
        mensaje: "Usuario o contraseña incorrectos",
      });
    }

    const empresasResult = await pool.query(
      `
      SELECT 
        companies.id,
        companies.nombre,
        companies.logo_url,
        companies.activo
      FROM user_companies
      INNER JOIN companies ON companies.id = user_companies.company_id
      WHERE user_companies.user_id = $1
      AND user_companies.activo = true
      AND companies.activo = true
      ORDER BY companies.nombre ASC
      `,
      [user.id]
    );

    if (empresasResult.rows.length === 0) {
      return res.status(403).json({
        mensaje: "El usuario no tiene empresas activas asignadas.",
      });
    }

    let empresaActiva = empresasResult.rows[0];

    if (company_id) {
      const empresaSeleccionada = empresasResult.rows.find(
        (empresa) => Number(empresa.id) === Number(company_id)
      );

      if (!empresaSeleccionada) {
        return res.status(403).json({
          mensaje: "El usuario no tiene acceso a la empresa seleccionada.",
        });
      }

      empresaActiva = empresaSeleccionada;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        company_id: empresaActiva.id,
        empresa: empresaActiva.nombre,
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
        company_id: empresaActiva.id,
        empresa: empresaActiva.nombre,
        empresa_activa: empresaActiva,
        empresas_disponibles: empresasResult.rows,
      },
    });
  } catch (error) {
    console.error("ERROR LOGIN:", error);

    res.status(500).json({
      mensaje: "Error en login",
      error: error.message,
    });
  }
};