import pool from "./src/config/db.js";

try {
  await pool.query(`
    ALTER TABLE evaluations
    ADD COLUMN IF NOT EXISTS foto_url TEXT
  `);

  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'evaluations'
    ORDER BY ordinal_position
  `);

  console.table(result.rows);

  console.log("Tabla evaluations actualizada correctamente con foto_url.");

  process.exit();
} catch (error) {
  console.error("Error actualizando evaluations:", error);
  process.exit(1);
}