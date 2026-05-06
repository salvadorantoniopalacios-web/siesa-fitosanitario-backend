import pool from "./src/config/db.js";

try {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true
  `);

  await pool.query(`
    UPDATE users
    SET activo = true
    WHERE activo IS NULL
  `);

  const result = await pool.query(`
    SELECT id, nombre, email, rol, activo, creado_en
    FROM users
    ORDER BY id
  `);

  console.table(result.rows);

  console.log("Tabla users actualizada correctamente.");
  process.exit();
} catch (error) {
  console.error("Error actualizando tabla users:", error);
  process.exit(1);
}