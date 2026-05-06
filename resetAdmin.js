import bcrypt from "bcryptjs";
import pool from "./src/config/db.js";

try {
  const passwordPlano = "admin";
  const passwordHash = await bcrypt.hash(passwordPlano, 10);

  await pool.query(
    `
    UPDATE users
    SET rol = $1,
        password = $2
    WHERE email = $3
    `,
    ["Admin", passwordHash, "admin@siesa.com"]
  );

  const result = await pool.query(`
    SELECT id, nombre, email, rol
    FROM users
    ORDER BY id
  `);

  console.table(result.rows);

  console.log("Usuario admin actualizado correctamente.");
  console.log("Correo: admin@siesa.com");
  console.log("Contraseña: admin");

  process.exit();
} catch (error) {
  console.error("Error actualizando admin:", error);
  process.exit(1);
}