import pool from "../config/db.js";

export const getLots = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.id,
        l.codigo,
        l.farm_id,
        f.nombre AS finca_nombre,
        l.cultivo,
        l.variedad,
        l.area_hectareas,
        l.fecha_siembra,
        l.estado,
        l.creado_en
      FROM lots l
      LEFT JOIN farms f ON l.farm_id = f.id
      ORDER BY l.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET LOTS:", error);
    res.status(500).json({
      mensaje: "Error obteniendo lotes",
      error: error.message,
    });
  }
};

export const createLot = async (req, res) => {
  try {
    console.log("DATA LOTE RECIBIDA:", req.body);

    const codigo = req.body.codigo;
    const farm_id = req.body.farm_id || req.body.finca_id;
    const cultivo = req.body.cultivo;
    const variedad = req.body.variedad || null;
    const area_hectareas = req.body.area_hectareas || req.body.area || null;
    const fecha_siembra = req.body.fecha_siembra || null;
    const estado = req.body.estado || "Activo";

    if (!codigo || !farm_id || !cultivo) {
      return res.status(400).json({
        mensaje: "Código, finca y cultivo son obligatorios",
      });
    }

    const fincaExiste = await pool.query("SELECT id FROM farms WHERE id = $1", [
      Number(farm_id),
    ]);

    if (fincaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La finca seleccionada no existe",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO lots 
      (codigo, farm_id, cultivo, variedad, area_hectareas, fecha_siembra, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        codigo,
        Number(farm_id),
        cultivo,
        variedad,
        area_hectareas && !isNaN(area_hectareas)
          ? Number(area_hectareas)
          : null,
        fecha_siembra,
        estado,
      ]
    );

    console.log("LOTE GUARDADO:", result.rows[0]);

    res.json({
      mensaje: "Lote creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE LOT:", error);

    res.status(500).json({
      mensaje: "Error creando lote",
      error: error.message,
    });
  }
};

export const updateLot = async (req, res) => {
  try {
    const { id } = req.params;

    const codigo = req.body.codigo;
    const farm_id = req.body.farm_id || req.body.finca_id;
    const cultivo = req.body.cultivo;
    const variedad = req.body.variedad || null;
    const area_hectareas = req.body.area_hectareas || req.body.area || null;
    const fecha_siembra = req.body.fecha_siembra || null;
    const estado = req.body.estado || "Activo";

    if (!codigo || !farm_id || !cultivo) {
      return res.status(400).json({
        mensaje: "Código, finca y cultivo son obligatorios",
      });
    }

    const fincaExiste = await pool.query("SELECT id FROM farms WHERE id = $1", [
      Number(farm_id),
    ]);

    if (fincaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La finca seleccionada no existe",
      });
    }

    const result = await pool.query(
      `
      UPDATE lots
      SET 
        codigo = $1,
        farm_id = $2,
        cultivo = $3,
        variedad = $4,
        area_hectareas = $5,
        fecha_siembra = $6,
        estado = $7
      WHERE id = $8
      RETURNING *
      `,
      [
        codigo,
        Number(farm_id),
        cultivo,
        variedad,
        area_hectareas && !isNaN(area_hectareas)
          ? Number(area_hectareas)
          : null,
        fecha_siembra,
        estado,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Lote no encontrado",
      });
    }

    res.json({
      mensaje: "Lote actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE LOT:", error);

    res.status(500).json({
      mensaje: "Error actualizando lote",
      error: error.message,
    });
  }
};

export const deleteLot = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM lots
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Lote no encontrado",
      });
    }

    res.json({
      mensaje: "Lote eliminado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE LOT:", error);

    if (error.code === "23503") {
      return res.status(409).json({
        mensaje:
          "No se puede eliminar este lote porque tiene evaluaciones o alertas asociadas.",
      });
    }

    res.status(500).json({
      mensaje: "Error eliminando lote",
      error: error.message,
    });
  }
};