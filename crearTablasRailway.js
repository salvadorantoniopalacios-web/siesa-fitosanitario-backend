import pool from "./src/config/db.js";
import bcrypt from "bcryptjs";

try {
  console.log("Creando tablas en PostgreSQL Railway...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      rol VARCHAR(50) NOT NULL DEFAULT 'Consulta',
      activo BOOLEAN DEFAULT true,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS farms (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      ubicacion VARCHAR(255) NOT NULL,
      area_hectareas NUMERIC,
      cultivo_principal VARCHAR(150),
      estado VARCHAR(50) DEFAULT 'Activa',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      latitud NUMERIC(10,7),
      longitud NUMERIC(10,7)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lots (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(100) NOT NULL,
      farm_id INTEGER REFERENCES farms(id),
      cultivo VARCHAR(150) NOT NULL,
      variedad VARCHAR(150),
      area_hectareas NUMERIC,
      fecha_siembra DATE,
      estado VARCHAR(50) DEFAULT 'Activo',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      farm_id INTEGER REFERENCES farms(id),
      lot_id INTEGER REFERENCES lots(id),
      plaga_enfermedad VARCHAR(200) NOT NULL,
      incidencia NUMERIC NOT NULL,
      severidad VARCHAR(50) NOT NULL,
      nivel_riesgo VARCHAR(50),
      observaciones TEXT,
      responsable VARCHAR(150),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      foto_url TEXT
    );
  `);

  const existeAdmin = await pool.query(`
    SELECT id FROM users WHERE email = 'admin@siesa.com'
  `);

  if (existeAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);

    await pool.query(
      `
      INSERT INTO users (nombre, email, password, rol, activo)
      VALUES ($1, $2, $3, $4, $5)
      `,
      ["Administrador SIESA", "admin@siesa.com", passwordHash, "Admin", true]
    );

    console.log("Usuario admin creado correctamente.");
  } else {
    console.log("El usuario admin ya existe.");
  }

  const tablas = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.table(tablas.rows);

  console.log("Base de datos Railway preparada correctamente.");
  process.exit(0);
} catch (error) {
  console.error("Error creando tablas Railway:", error);
  process.exit(1);
}