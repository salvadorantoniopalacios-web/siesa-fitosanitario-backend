import pool from "../config/db.js";

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const normalizarNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) {
    return null;
  }

  const numero = Number(valor);

  return Number.isNaN(numero) ? null : numero;
};

export const getFarms = async (req, res) => {
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
        id,
        nombre,
        ubicacion,
        area_hectareas,
        cultivo_principal,
        estado,
        latitud,
        longitud,
        company_id
      FROM farms
      WHERE company_id = $1
      ORDER BY id DESC
      `,
      [companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo fincas:", error);

    res.status(500).json({
      mensaje: "Error obteniendo fincas",
      error: error.message,
    });
  }
};

export const createFarm = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    const {
      nombre,
      ubicacion,
      area_hectareas,
      cultivo_principal,
      latitud,
      longitud,
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    if (!nombre || !ubicacion || !area_hectareas || !cultivo_principal) {
      return res.status(400).json({
        mensaje: "Todos los campos principales son obligatorios",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO farms (
        nombre,
        ubicacion,
        area_hectareas,
        cultivo_principal,
        latitud,
        longitud,
        company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        nombre,
        ubicacion,
        Number(area_hectareas),
        cultivo_principal,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
        companyId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creando finca:", error);

    res.status(500).json({
      mensaje: "Error creando finca",
      error: error.message,
    });
  }
};

export const updateFarm = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    const {
      nombre,
      ubicacion,
      area_hectareas,
      cultivo_principal,
      latitud,
      longitud,
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    if (!nombre || !ubicacion || !area_hectareas || !cultivo_principal) {
      return res.status(400).json({
        mensaje: "Todos los campos principales son obligatorios",
      });
    }

    const result = await pool.query(
      `
      UPDATE farms
      SET 
        nombre = $1,
        ubicacion = $2,
        area_hectareas = $3,
        cultivo_principal = $4,
        latitud = $5,
        longitud = $6
      WHERE id = $7
      AND company_id = $8
      RETURNING *
      `,
      [
        nombre,
        ubicacion,
        Number(area_hectareas),
        cultivo_principal,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
        id,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Finca no encontrada para esta empresa",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando finca:", error);

    res.status(500).json({
      mensaje: "Error actualizando finca",
      error: error.message,
    });
  }
};

export const deleteFarm = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM farms
      WHERE id = $1
      AND company_id = $2
      RETURNING *
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Finca no encontrada para esta empresa",
      });
    }

    res.json({
      mensaje: "Finca eliminada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error eliminando finca:", error);

    if (error.code === "23503") {
      return res.status(409).json({
        mensaje: "No se puede eliminar esta finca porque tiene lotes asociados.",
      });
    }

    res.status(500).json({
      mensaje: "Error eliminando finca",
      error: error.message,
    });
  }
};