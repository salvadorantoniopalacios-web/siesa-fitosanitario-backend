import pool from "./src/config/db.js";

try {
  const result = await pool.query(`
    SELECT 
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);

  console.table(result.rows);

  process.exit();
} catch (error) {
  console.error("Error:", error);
  process.exit(1);
}