import pool from "../config/db.js";

export const getCompanies = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        nombre,
        nit,
        direccion,
        telefono,
        logo_url,
        activo,
        creado_en
      FROM companies
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error obteniendo empresas",
      error: error.message,
    });
  }
};

export const createCompany = async (req, res) => {
  try {
    const { nombre, nit, direccion, telefono, logo_url } = req.body;

    if (!nombre) {
      return res.status(400).json({
        mensaje: "El nombre de la empresa es obligatorio",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO companies (nombre, nit, direccion, telefono, logo_url, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
      `,
      [nombre, nit || null, direccion || null, telefono || null, logo_url || null]
    );

    res.json({
      mensaje: "Empresa creada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error creando empresa",
      error: error.message,
    });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, nit, direccion, telefono, logo_url, activo } = req.body;

    if (!nombre) {
      return res.status(400).json({
        mensaje: "El nombre de la empresa es obligatorio",
      });
    }

    const result = await pool.query(
      `
      UPDATE companies
      SET nombre = $1,
          nit = $2,
          direccion = $3,
          telefono = $4,
          logo_url = $5,
          activo = $6
      WHERE id = $7
      RETURNING *
      `,
      [
        nombre,
        nit || null,
        direccion || null,
        telefono || null,
        logo_url || null,
        activo === false ? false : true,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Empresa no encontrada",
      });
    }

    res.json({
      mensaje: "Empresa actualizada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error actualizando empresa",
      error: error.message,
    });
  }
};

export const toggleCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE companies
      SET activo = NOT activo
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Empresa no encontrada",
      });
    }

    res.json({
      mensaje: result.rows[0].activo
        ? "Empresa activada correctamente"
        : "Empresa desactivada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error cambiando estado de empresa",
      error: error.message,
    });
  }
};