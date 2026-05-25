import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const rolesPermitidos = ["Admin", "Técnico", "Consulta"];

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

export const getUsers = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
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
      WHERE users.company_id = $1
      ORDER BY users.id DESC
      `,
      [companyId]
    );

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
    const companyId = obtenerCompanyId(req);
    const { nombre, email, password, rol } = req.body;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        mensaje: "Nombre, email, contraseña y rol son obligatorios",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "Rol no válido. Use Admin, Técnico o Consulta.",
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
      [nombre, email, passwordHash, rol, companyId]
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
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;
    const { nombre, email, rol, password, activo } = req.body;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    if (!nombre || !email || !rol) {
      return res.status(400).json({
        mensaje: "Nombre, email y rol son obligatorios",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "Rol no válido. Use Admin, Técnico o Consulta.",
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
      AND company_id = $2
      `,
      [id, companyId]
    );

    if (usuarioExiste.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado para esta empresa",
      });
    }

    const activoFinal =
      activo === true || activo === false ? activo : true;

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
            activo = $5
        WHERE id = $6
        AND company_id = $7
        RETURNING id, nombre, email, rol, activo, company_id, creado_en
        `,
        [nombre, email, rol, passwordHash, activoFinal, id, companyId]
      );
    } else {
      result = await pool.query(
        `
        UPDATE users
        SET nombre = $1,
            email = $2,
            rol = $3,
            activo = $4
        WHERE id = $5
        AND company_id = $6
        RETURNING id, nombre, email, rol, activo, company_id, creado_en
        `,
        [nombre, email, rol, activoFinal, id, companyId]
      );
    }

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
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

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
      AND company_id = $2
      RETURNING id, nombre, email, rol, activo, company_id, creado_en
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado para esta empresa",
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
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    if (Number(req.usuario.id) === Number(id)) {
      return res.status(400).json({
        mensaje: "No puedes eliminar tu propio usuario activo",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      AND company_id = $2
      RETURNING id, nombre, email, rol, activo, company_id, creado_en
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado para esta empresa",
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