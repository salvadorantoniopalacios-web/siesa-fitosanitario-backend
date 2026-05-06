import pool from "./src/config/db.js";

const actualizarFarmsGps = async () => {
  try {
    await pool.query(`
      ALTER TABLE farms
      ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7),
      ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7);
    `);

    const columnas = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'farms'
      ORDER BY ordinal_position;
    `);

    console.table(columnas.rows);
    console.log("Tabla farms actualizada correctamente con latitud y longitud.");

    process.exit(0);
  } catch (error) {
    console.error("Error actualizando tabla farms:", error);
    process.exit(1);
  }
};

actualizarFarmsGps();