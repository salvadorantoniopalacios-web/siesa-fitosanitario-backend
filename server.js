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