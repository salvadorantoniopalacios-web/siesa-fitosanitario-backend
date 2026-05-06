import pool from "../config/db.js";

export const getFarms = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        nombre,
        ubicacion,
        area_hectareas,
        cultivo_principal,
        estado,
        latitud,
        longitud
      FROM farms
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo fincas:", error);
    res.status(500).json({ mensaje: "Error obteniendo fincas" });
  }
};

export const createFarm = async (req, res) => {
  try {
    const {
      nombre,
      ubicacion,
      area_hectareas,
      cultivo_principal,
      latitud,
      longitud,
    } = req.body;

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
        longitud
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        nombre,
        ubicacion,
        Number(area_hectareas),
        cultivo_principal,
        latitud !== "" && latitud !== null && latitud !== undefined
          ? Number(latitud)
          : null,
        longitud !== "" && longitud !== null && longitud !== undefined
          ? Number(longitud)
          : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creando finca:", error);
    res.status(500).json({ mensaje: "Error creando finca" });
  }
};

export const updateFarm = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      ubicacion,
      area_hectareas,
      cultivo_principal,
      latitud,
      longitud,
    } = req.body;

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
      RETURNING *
      `,
      [
        nombre,
        ubicacion,
        Number(area_hectareas),
        cultivo_principal,
        latitud !== "" && latitud !== null && latitud !== undefined
          ? Number(latitud)
          : null,
        longitud !== "" && longitud !== null && longitud !== undefined
          ? Number(longitud)
          : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando finca:", error);
    res.status(500).json({ mensaje: "Error actualizando finca" });
  }
};

export const deleteFarm = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM farms
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    res.json({ mensaje: "Finca eliminada correctamente" });
  } catch (error) {
    console.error("Error eliminando finca:", error);

    if (error.code === "23503") {
      return res.status(409).json({
        mensaje: "No se puede eliminar esta finca porque tiene lotes asociados.",
      });
    }

    res.status(500).json({ mensaje: "Error eliminando finca" });
  }
};