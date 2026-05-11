import pool from "../config/db.js";

const crearTablasCatalogo = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crops (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL UNIQUE,
      estado VARCHAR(20) DEFAULT 'Activo',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pests (
      id SERIAL PRIMARY KEY,
      crop_id INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
      nombre VARCHAR(150) NOT NULL,
      tipo VARCHAR(50) DEFAULT 'Plaga',
      estado VARCHAR(20) DEFAULT 'Activo',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (crop_id, nombre)
    );
  `);
};

const puedeCrearEditar = (req) => {
  const rol = String(req.usuario?.rol || "").toLowerCase();
  return rol === "admin" || rol === "técnico" || rol === "tecnico";
};

const puedeEliminar = (req) => {
  const rol = String(req.usuario?.rol || "").toLowerCase();
  return rol === "admin";
};

export const getCrops = async (req, res) => {
  try {
    await crearTablasCatalogo();

    const result = await pool.query(`
      SELECT *
      FROM crops
      ORDER BY nombre ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET CROPS:", error);
    res.status(500).json({
      mensaje: "Error obteniendo cultivos",
      error: error.message,
    });
  }
};

export const createCrop = async (req, res) => {
  try {
    await crearTablasCatalogo();

    if (!puedeCrearEditar(req)) {
      return res.status(403).json({
        mensaje: "No tiene permisos para crear cultivos.",
      });
    }

    const { nombre, estado } = req.body;

    if (!nombre) {
      return res.status(400).json({
        mensaje: "El nombre del cultivo es obligatorio.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO crops (nombre, estado)
      VALUES ($1, $2)
      RETURNING *
      `,
      [nombre.trim(), estado || "Activo"]
    );

    res.json({
      mensaje: "Cultivo creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE CROP:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Este cultivo ya existe.",
      });
    }

    res.status(500).json({
      mensaje: "Error creando cultivo",
      error: error.message,
    });
  }
};

export const updateCrop = async (req, res) => {
  try {
    await crearTablasCatalogo();

    if (!puedeCrearEditar(req)) {
      return res.status(403).json({
        mensaje: "No tiene permisos para editar cultivos.",
      });
    }

    const { id } = req.params;
    const { nombre, estado } = req.body;

    if (!nombre) {
      return res.status(400).json({
        mensaje: "El nombre del cultivo es obligatorio.",
      });
    }

    const result = await pool.query(
      `
      UPDATE crops
      SET nombre = $1,
          estado = $2
      WHERE id = $3
      RETURNING *
      `,
      [nombre.trim(), estado || "Activo", id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Cultivo no encontrado.",
      });
    }

    res.json({
      mensaje: "Cultivo actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE CROP:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Ya existe otro cultivo con ese nombre.",
      });
    }

    res.status(500).json({
      mensaje: "Error actualizando cultivo",
      error: error.message,
    });
  }
};

export const deleteCrop = async (req, res) => {
  try {
    await crearTablasCatalogo();

    if (!puedeEliminar(req)) {
      return res.status(403).json({
        mensaje: "Solo un usuario Admin puede eliminar cultivos.",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM crops
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Cultivo no encontrado.",
      });
    }

    res.json({
      mensaje: "Cultivo eliminado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE CROP:", error);

    res.status(500).json({
      mensaje: "Error eliminando cultivo",
      error: error.message,
    });
  }
};

export const getPests = async (req, res) => {
  try {
    await crearTablasCatalogo();

    const result = await pool.query(`
      SELECT 
        pests.*,
        crops.nombre AS cultivo
      FROM pests
      JOIN crops ON crops.id = pests.crop_id
      ORDER BY crops.nombre ASC, pests.nombre ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET PESTS:", error);
    res.status(500).json({
      mensaje: "Error obteniendo plagas",
      error: error.message,
    });
  }
};

export const getPestsByCrop = async (req, res) => {
  try {
    await crearTablasCatalogo();

    const { crop_id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        pests.*,
        crops.nombre AS cultivo
      FROM pests
      JOIN crops ON crops.id = pests.crop_id
      WHERE pests.crop_id = $1
        AND pests.estado = 'Activo'
      ORDER BY pests.nombre ASC
      `,
      [crop_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET PESTS BY CROP:", error);
    res.status(500).json({
      mensaje: "Error obteniendo plagas del cultivo",
      error: error.message,
    });
  }
};

export const createPest = async (req, res) => {
  try {
    await crearTablasCatalogo();

    if (!puedeCrearEditar(req)) {
      return res.status(403).json({
        mensaje: "No tiene permisos para crear plagas.",
      });
    }

    const { crop_id, nombre, tipo, estado } = req.body;

    if (!crop_id || !nombre) {
      return res.status(400).json({
        mensaje: "Cultivo y nombre de plaga son obligatorios.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO pests (crop_id, nombre, tipo, estado)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [Number(crop_id), nombre.trim(), tipo || "Plaga", estado || "Activo"]
    );

    res.json({
      mensaje: "Plaga creada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE PEST:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Esta plaga ya existe para este cultivo.",
      });
    }

    res.status(500).json({
      mensaje: "Error creando plaga",
      error: error.message,
    });
  }
};

export const updatePest = async (req, res) => {
  try {
    await crearTablasCatalogo();

    if (!puedeCrearEditar(req)) {
      return res.status(403).json({
        mensaje: "No tiene permisos para editar plagas.",
      });
    }

    const { id } = req.params;
    const { crop_id, nombre, tipo, estado } = req.body;

    if (!crop_id || !nombre) {
      return res.status(400).json({
        mensaje: "Cultivo y nombre de plaga son obligatorios.",
      });
    }

    const result = await pool.query(
      `
      UPDATE pests
      SET crop_id = $1,
          nombre = $2,
          tipo = $3,
          estado = $4
      WHERE id = $5
      RETURNING *
      `,
      [Number(crop_id), nombre.trim(), tipo || "Plaga", estado || "Activo", id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Plaga no encontrada.",
      });
    }

    res.json({
      mensaje: "Plaga actualizada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE PEST:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Ya existe esta plaga para este cultivo.",
      });
    }

    res.status(500).json({
      mensaje: "Error actualizando plaga",
      error: error.message,
    });
  }
};

export const deletePest = async (req, res) => {
  try {
    await crearTablasCatalogo();

    if (!puedeEliminar(req)) {
      return res.status(403).json({
        mensaje: "Solo un usuario Admin puede eliminar plagas.",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM pests
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Plaga no encontrada.",
      });
    }

    res.json({
      mensaje: "Plaga eliminada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE PEST:", error);

    res.status(500).json({
      mensaje: "Error eliminando plaga",
      error: error.message,
    });
  }
};