import bcrypt from "bcryptjs";
import pool from "./config/db.js";

const createAdmin = async () => {
  try {
    const nombre = "Administrador SIESA";
    const email = "admin@siesa.com";
    const passwordPlano = "Admin123";
    const rol = "Administrador";

    const passwordEncriptado = await bcrypt.hash(passwordPlano, 10);

    await pool.query(
      `
      INSERT INTO users (nombre, email, password, rol)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING;
      `,
      [nombre, email, passwordEncriptado, rol]
    );

    console.log("Usuario administrador creado correctamente");
    console.log("Email: admin@siesa.com");
    console.log("Password: Admin123");
    process.exit();
  } catch (error) {
    console.error("Error creando administrador:", error.message);
    process.exit(1);
  }
};

createAdmin();