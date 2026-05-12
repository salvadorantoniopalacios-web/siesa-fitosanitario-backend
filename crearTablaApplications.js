import pool from "./src/config/db.js";

const crearTabla = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,

        fecha DATE NOT NULL,

        farm_id INTEGER NOT NULL REFERENCES farms(id),

        lot_id INTEGER NOT NULL REFERENCES lots(id),

        cultivo VARCHAR(150),

        plaga_objetivo VARCHAR(200) NOT NULL,

        producto_aplicado VARCHAR(200) NOT NULL,

        ingrediente_activo VARCHAR(200),

        dosis VARCHAR(100),

        unidad VARCHAR(50),

        volumen_agua VARCHAR(100),

        responsable VARCHAR(150),

        equipo_usado VARCHAR(150),

        observaciones TEXT,

        foto_url TEXT,

        latitud NUMERIC(12,8),

        longitud NUMERIC(12,8),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Tabla applications creada correctamente");

    process.exit();
  } catch (error) {
    console.error("❌ Error creando tabla:", error.message);

    process.exit(1);
  }
};

crearTabla();