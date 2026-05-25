import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const rolesPermitidos = ["Admin", "Técnico", "Consulta"];

export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        users.id, 
        users.nombre, 
        users.email, 
        users.rol,
        users.activo,
        users.company_id,
        companies.nombre AS empresa,
        users.creado_en
      FROM users
      LEFT JOIN companies ON companies.id = users.company_id
      ORDER BY users.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error obteniendo usuarios",
      error: error.message,
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const { nombre, email, password, rol, company_id } = req.body;

    if (!nombre || !email || !password || !rol || !company_id) {
      return res.status(400).json({
        mensaje: "Nombre, email, contraseña, rol y empresa son obligatorios",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "Rol no válido. Use Admin, Técnico o Consulta.",
      });
    }

    const empresaExiste = await pool.query(
      `
      SELECT id 
      FROM companies 
      WHERE id = $1
      AND activo = true
      `,
      [company_id]
    );

    if (empresaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La empresa seleccionada no existe o está inactiva",
      });
    }

    const existe = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);

    if (existe.rows.length > 0) {
      return res.status(409).json({
        mensaje: "Ya existe un usuario con este correo",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (nombre, email, password, rol, activo, company_id)
      VALUES ($1, $2, $3, $4, true, $5)
      RETURNING id, nombre, email, rol, activo, company_id, creado_en
      `,
      [nombre, email, passwordHash, rol, company_id]
    );

    await pool.query(
      `
      INSERT INTO user_companies (user_id, company_id, activo)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, company_id) DO NOTHING
      `,
      [result.rows[0].id, company_id]
    );

    res.json({
      mensaje: "Usuario creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error creando usuario",
      error: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password, activo, company_id } = req.body;

    if (!nombre || !email || !rol || !company_id) {
      return res.status(400).json({
        mensaje: "Nombre, email, rol y empresa son obligatorios",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "Rol no válido. Use Admin, Técnico o Consulta.",
      });
    }

    const empresaExiste = await pool.query(
      `
      SELECT id 
      FROM companies 
      WHERE id = $1
      AND activo = true
      `,
      [company_id]
    );

    if (empresaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La empresa seleccionada no existe o está inactiva",
      });
    }

    const existeCorreo = await pool.query(
      `
      SELECT id 
      FROM users 
      WHERE email = $1 
      AND id <> $2
      `,
      [email, id]
    );

    if (existeCorreo.rows.length > 0) {
      return res.status(409).json({
        mensaje: "Ya existe otro usuario con este correo",
      });
    }

    const usuarioExiste = await pool.query(
      `
      SELECT id 
      FROM users 
      WHERE id = $1
      `,
      [id]
    );

    if (usuarioExiste.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    const activoFinal = activo === true || activo === false ? activo : true;

    let result;

    if (password && password.trim() !== "") {
      const passwordHash = await bcrypt.hash(password, 10);

      result = await pool.query(
        `
        UPDATE users
        SET nombre = $1,
            email = $2,
            rol = $3,
            password = $4,
            activo = $5,
            company_id = $6
        WHERE id = $7
        RETURNING id, nombre, email, rol, activo, company_id, creado_en
        `,
        [nombre, email, rol, passwordHash, activoFinal, company_id, id]
      );
    } else {
      result = await pool.query(
        `
        UPDATE users
        SET nombre = $1,
            email = $2,
            rol = $3,
            activo = $4,
            company_id = $5
        WHERE id = $6
        RETURNING id, nombre, email, rol, activo, company_id, creado_en
        `,
        [nombre, email, rol, activoFinal, company_id, id]
      );
    }

    await pool.query(
      `
      INSERT INTO user_companies (user_id, company_id, activo)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, company_id) DO UPDATE
      SET activo = true
      `,
      [id, company_id]
    );

    res.json({
      mensaje: "Usuario actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error actualizando usuario",
      error: error.message,
    });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(req.usuario.id) === Number(id)) {
      return res.status(400).json({
        mensaje: "No puedes desactivar tu propio usuario activo",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET activo = NOT activo
      WHERE id = $1
      RETURNING id, nombre, email, rol, activo, company_id, creado_en
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    res.json({
      mensaje: result.rows[0].activo
        ? "Usuario activado correctamente"
        : "Usuario desactivado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error cambiando estado del usuario",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(req.usuario.id) === Number(id)) {
      return res.status(400).json({
        mensaje: "No puedes eliminar tu propio usuario activo",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, nombre, email, rol, activo, company_id, creado_en
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    res.json({
      mensaje: "Usuario eliminado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error eliminando usuario",
      error: error.message,
    });
  }
};