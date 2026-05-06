import pool from "./config/db.js";

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        password VARCHAR(255),
        rol VARCHAR(50),
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS farms (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        ubicacion VARCHAR(150),
        area_hectareas NUMERIC(10,2),
        cultivo_principal VARCHAR(100),
        estado VARCHAR(50) DEFAULT 'Activa',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lots (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) NOT NULL,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        cultivo VARCHAR(100) NOT NULL,
        variedad VARCHAR(100),
        area_hectareas NUMERIC(10,2),
        fecha_siembra DATE,
        estado VARCHAR(50) DEFAULT 'Activo',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        lot_id INTEGER REFERENCES lots(id) ON DELETE CASCADE,
        plaga_enfermedad VARCHAR(150) NOT NULL,
        incidencia NUMERIC(10,2),
        severidad VARCHAR(50),
        nivel_riesgo VARCHAR(50),
        observaciones TEXT,
        responsable VARCHAR(100),
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Tablas users, farms, lots y evaluations creadas correctamente");
    process.exit();
  } catch (error) {
    console.error("Error creando tablas:", error.message);
    process.exit(1);
  }
};

initDB();