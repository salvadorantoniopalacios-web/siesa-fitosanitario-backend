import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const rolesPermitidos = ["SuperAdmin", "Admin", "Técnico", "Consulta"];

const esSuperAdmin = (req) => {
  return req.usuario?.rol === "SuperAdmin";
};

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const obtenerCompanyFinal = (req, company_id_body) => {
  if (esSuperAdmin(req)) {
    return company_id_body;
  }

  return obtenerCompanyId(req);
};

export const getUsers = async (req, res) => {
  try {
    if (esSuperAdmin(req)) {
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

      return res.json(result.rows);
    }

    const companyId = obtenerCompanyId(req);

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
    const { nombre, email, password, rol, company_id } = req.body;

    const companyFinal = obtenerCompanyFinal(req, company_id);

    if (!nombre || !email || !password || !rol || !companyFinal) {
      return res.status(400).json({
        mensaje: "Nombre, email, contraseña, rol y empresa son obligatorios",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "Rol no válido.",
      });
    }

    if (!esSuperAdmin(req) && rol === "SuperAdmin") {
      return res.status(403).json({
        mensaje: "Solo SuperAdmin puede crear usuarios SuperAdmin.",
      });
    }

    const empresaExiste = await pool.query(
      `
      SELECT id 
      FROM companies 
      WHERE id = $1
      AND activo = true
      `,
      [companyFinal]
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
      [nombre, email, passwordHash, rol, companyFinal]
    );

    await pool.query(
      `
      INSERT INTO user_companies (user_id, company_id, activo)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, company_id) DO NOTHING
      `,
      [result.rows[0].id, companyFinal]
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

    const companyFinal = obtenerCompanyFinal(req, company_id);

    if (!nombre || !email || !rol || !companyFinal) {
      return res.status(400).json({
        mensaje: "Nombre, email, rol y empresa son obligatorios",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "Rol no válido.",
      });
    }

    if (!esSuperAdmin(req) && rol === "SuperAdmin") {
      return res.status(403).json({
        mensaje: "Solo SuperAdmin puede asignar rol SuperAdmin.",
      });
    }

    const usuarioExiste = await pool.query(
      `
      SELECT id, company_id
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

    if (!esSuperAdmin(req)) {
      const companyId = obtenerCompanyId(req);

      if (Number(usuarioExiste.rows[0].company_id) !== Number(companyId)) {
        return res.status(403).json({
          mensaje: "No puede modificar usuarios de otra empresa.",
        });
      }
    }

    const empresaExiste = await pool.query(
      `
      SELECT id 
      FROM companies 
      WHERE id = $1
      AND activo = true
      `,
      [companyFinal]
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
        [nombre, email, rol, passwordHash, activoFinal, companyFinal, id]
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
        [nombre, email, rol, activoFinal, companyFinal, id]
      );
    }

    await pool.query(
      `
      INSERT INTO user_companies (user_id, company_id, activo)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, company_id) DO UPDATE
      SET activo = true
      `,
      [id, companyFinal]
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

    const usuarioExiste = await pool.query(
      `
      SELECT id, company_id
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

    if (!esSuperAdmin(req)) {
      const companyId = obtenerCompanyId(req);

      if (Number(usuarioExiste.rows[0].company_id) !== Number(companyId)) {
        return res.status(403).json({
          mensaje: "No puede cambiar estado de usuarios de otra empresa.",
        });
      }
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

    const usuarioExiste = await pool.query(
      `
      SELECT id, company_id
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

    if (!esSuperAdmin(req)) {
      const companyId = obtenerCompanyId(req);

      if (Number(usuarioExiste.rows[0].company_id) !== Number(companyId)) {
        return res.status(403).json({
          mensaje: "No puede eliminar usuarios de otra empresa.",
        });
      }
    }

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, nombre, email, rol, activo, company_id, creado_en
      `,
      [id]
    );

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