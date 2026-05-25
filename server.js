import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import companyRoutes from "./src/routes/companyRoutes.js";
import pool from "./src/config/db.js";

import authRoutes from "./src/routes/authRoutes.js";
import farmRoutes from "./src/routes/farmRoutes.js";
import lotRoutes from "./src/routes/lotRoutes.js";
import evaluationRoutes from "./src/routes/evaluationRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import alertRoutes from "./src/routes/alertRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import aiRoutes from "./src/routes/aiRoutes.js";
import catalogRoutes from "./src/routes/catalogRoutes.js";
import applicationRoutes from "./src/routes/applicationRoutes.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsPath = path.join(__dirname, "uploads");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origen no permitido por CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("Uploads servido desde:", uploadsPath);
app.use("/uploads", express.static(uploadsPath));

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      mensaje: "Backend SIESA conectado a BD",
      ambiente: process.env.NODE_ENV || "development",
      hora_servidor: result.rows[0].now,
      uploads: uploadsPath,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error conectando a BD",
      error: error.message,
    });
  }
});

/*
========================================
RESET ADMIN TEMPORAL
========================================
*/
app.get("/reset-admin", async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash("123456", 10);

    const existe = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      ["admin@siesa.com"]
    );

    if (existe.rows.length > 0) {
      await pool.query(
        `
        UPDATE users
        SET password = $1
        WHERE email = $2
        `,
        [passwordHash, "admin@siesa.com"]
      );

      return res.json({
        mensaje: "Contraseña actualizada",
        email: "admin@siesa.com",
        password: "123456",
      });
    }

    await pool.query(
      `
      INSERT INTO users
      (nombre, email, password, rol)
      VALUES ($1, $2, $3, $4)
      `,
      ["Administrador", "admin@siesa.com", passwordHash, "Admin"]
    );

    res.json({
      mensaje: "Usuario admin creado",
      email: "admin@siesa.com",
      password: "123456",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error creando admin",
      error: error.message,
    });
  }
});

/*
========================================
MIGRACIÓN TEMPORAL SAAS MULTIEMPRESA
========================================
*/
app.get("/setup-user-companies", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_companies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        activo BOOLEAN DEFAULT true,
        creado_en TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, company_id)
      )
    `);

    await pool.query(`
      INSERT INTO user_companies (user_id, company_id, activo)
      SELECT id, company_id, true
      FROM users
      WHERE company_id IS NOT NULL
      ON CONFLICT (user_id, company_id) DO NOTHING
    `);

    res.json({
      mensaje: "Tabla user_companies creada y datos iniciales migrados correctamente",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error creando user_companies",
      error: error.message,
    });
  }
});
/*
========================================
CONVERTIR ADMIN ACTUAL A SUPERADMIN
========================================
*/
app.get("/make-superadmin", async (req, res) => {
  try {
    const email = req.query.email || "admin@siesa.com";

    const usuario = await pool.query(
      `
      SELECT id, email, company_id
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (usuario.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
        email,
      });
    }

    await pool.query(
      `
      UPDATE users
      SET rol = 'SuperAdmin',
          activo = true
      WHERE email = $1
      `,
      [email]
    );

    await pool.query(
      `
      INSERT INTO user_companies (user_id, company_id, activo)
      SELECT $1, id, true
      FROM companies
      WHERE activo = true
      ON CONFLICT (user_id, company_id) DO UPDATE
      SET activo = true
      `,
      [usuario.rows[0].id]
    );

    res.json({
      mensaje: "Usuario convertido a SuperAdmin y asignado a todas las empresas",
      email,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error convirtiendo a SuperAdmin",
      error: error.message,
    });
  }
});
/*
========================================
DIAGNÓSTICO MULTIEMPRESA
========================================
*/
app.get("/debug-companies-data", async (req, res) => {
  try {
    const companies = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.activo,
        COUNT(DISTINCT f.id) AS fincas,
        COUNT(DISTINCT l.id) AS lotes,
        COUNT(DISTINCT e.id) AS evaluaciones
      FROM companies c
      LEFT JOIN farms f ON f.company_id = c.id
      LEFT JOIN lots l ON l.company_id = c.id
      LEFT JOIN evaluations e ON e.company_id = c.id
      GROUP BY c.id, c.nombre, c.activo
      ORDER BY c.id ASC
    `);

    const users = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.company_id,
        c.nombre AS empresa
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      ORDER BY u.id ASC
    `);

    res.json({
      companies: companies.rows,
      users: users.rows,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error diagnóstico multiempresa",
      error: error.message,
    });
  }
});
app.use("/api/auth", authRoutes);
app.use("/api/farms", farmRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/applications", applicationRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor backend funcionando en puerto ${PORT}`);
});