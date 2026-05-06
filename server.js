import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./src/config/db.js";

import authRoutes from "./src/routes/authRoutes.js";
import farmRoutes from "./src/routes/farmRoutes.js";
import lotRoutes from "./src/routes/lotRoutes.js";
import evaluationRoutes from "./src/routes/evaluationRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import alertRoutes from "./src/routes/alertRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      mensaje: "Backend SIESA conectado a BD",
      ambiente: process.env.NODE_ENV || "development",
      hora_servidor: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error conectando a BD",
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor backend funcionando en puerto ${PORT}`);
});