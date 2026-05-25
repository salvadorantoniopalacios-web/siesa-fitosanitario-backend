import pool from "../config/db.js";

const obtenerFotoUrl = (req) => {
  if (!req.file) return null;
  return `/uploads/${req.file.filename}`;
};

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const normalizarNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;

  const numero = Number(valor);

  return Number.isNaN(numero) ? null : numero;
};

export const getApplications = async (req, res) => {
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
        applications.*,
        farms.nombre AS finca,
        lots.codigo AS lote
      FROM applications
      JOIN farms ON farms.id = applications.farm_id
      JOIN lots ON lots.id = applications.lot_id
      WHERE applications.company_id = $1
      ORDER BY applications.fecha DESC, applications.id DESC
      `,
      [companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET APPLICATIONS:", error);

    res.status(500).json({
      mensaje: "Error obteniendo aplicaciones fitosanitarias",
      error: error.message,
    });
  }
};

export const createApplication = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const {
      fecha,
      farm_id,
      lot_id,
      cultivo,
      plaga_objetivo,
      producto_aplicado,
      ingrediente_activo,
      dosis,
      unidad,
      volumen_agua,
      responsable,
      equipo_usado,
      observaciones,
      latitud,
      longitud,
    } = req.body;

    if (!fecha || !farm_id || !lot_id || !plaga_objetivo || !producto_aplicado) {
      return res.status(400).json({
        mensaje:
          "Fecha, finca, lote, plaga objetivo y producto aplicado son obligatorios",
      });
    }

    const fincaExiste = await pool.query(
      `
      SELECT id
      FROM farms
      WHERE id = $1
      AND company_id = $2
      `,
      [Number(farm_id), companyId]
    );

    if (fincaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La finca seleccionada no existe o no pertenece a esta empresa.",
      });
    }

    const loteExiste = await pool.query(
      `
      SELECT id
      FROM lots
      WHERE id = $1
      AND farm_id = $2
      AND company_id = $3
      `,
      [Number(lot_id), Number(farm_id), companyId]
    );

    if (loteExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "El lote seleccionado no existe o no pertenece a esta empresa.",
      });
    }

    const foto_url = obtenerFotoUrl(req);

    const result = await pool.query(
      `
      INSERT INTO applications (
        fecha,
        farm_id,
        lot_id,
        cultivo,
        plaga_objetivo,
        producto_aplicado,
        ingrediente_activo,
        dosis,
        unidad,
        volumen_agua,
        responsable,
        equipo_usado,
        observaciones,
        foto_url,
        latitud,
        longitud,
        company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        cultivo || null,
        plaga_objetivo,
        producto_aplicado,
        ingrediente_activo || null,
        dosis || null,
        unidad || null,
        volumen_agua || null,
        responsable || null,
        equipo_usado || null,
        observaciones || null,
        foto_url,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
        companyId,
      ]
    );

    res.json({
      mensaje: "Aplicación fitosanitaria creada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error creando aplicación fitosanitaria",
      error: error.message,
    });
  }
};

export const updateApplication = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const { id } = req.params;

    const {
      fecha,
      farm_id,
      lot_id,
      cultivo,
      plaga_objetivo,
      producto_aplicado,
      ingrediente_activo,
      dosis,
      unidad,
      volumen_agua,
      responsable,
      equipo_usado,
      observaciones,
      latitud,
      longitud,
    } = req.body;

    if (!fecha || !farm_id || !lot_id || !plaga_objetivo || !producto_aplicado) {
      return res.status(400).json({
        mensaje:
          "Fecha, finca, lote, plaga objetivo y producto aplicado son obligatorios",
      });
    }

    const fincaExiste = await pool.query(
      `
      SELECT id
      FROM farms
      WHERE id = $1
      AND company_id = $2
      `,
      [Number(farm_id), companyId]
    );

    if (fincaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La finca seleccionada no existe o no pertenece a esta empresa.",
      });
    }

    const loteExiste = await pool.query(
      `
      SELECT id
      FROM lots
      WHERE id = $1
      AND farm_id = $2
      AND company_id = $3
      `,
      [Number(lot_id), Number(farm_id), companyId]
    );

    if (loteExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "El lote seleccionado no existe o no pertenece a esta empresa.",
      });
    }

    const actual = await pool.query(
      `
      SELECT foto_url
      FROM applications
      WHERE id = $1
      AND company_id = $2
      `,
      [id, companyId]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Aplicación fitosanitaria no encontrada para esta empresa",
      });
    }

    const nuevaFotoUrl = obtenerFotoUrl(req);
    const foto_url = nuevaFotoUrl || actual.rows[0].foto_url || null;

    const result = await pool.query(
      `
      UPDATE applications
      SET
        fecha = $1,
        farm_id = $2,
        lot_id = $3,
        cultivo = $4,
        plaga_objetivo = $5,
        producto_aplicado = $6,
        ingrediente_activo = $7,
        dosis = $8,
        unidad = $9,
        volumen_agua = $10,
        responsable = $11,
        equipo_usado = $12,
        observaciones = $13,
        foto_url = $14,
        latitud = $15,
        longitud = $16
      WHERE id = $17
      AND company_id = $18
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        cultivo || null,
        plaga_objetivo,
        producto_aplicado,
        ingrediente_activo || null,
        dosis || null,
        unidad || null,
        volumen_agua || null,
        responsable || null,
        equipo_usado || null,
        observaciones || null,
        foto_url,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
        id,
        companyId,
      ]
    );

    res.json({
      mensaje: "Aplicación fitosanitaria actualizada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error actualizando aplicación fitosanitaria",
      error: error.message,
    });
  }
};

export const deleteApplication = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM applications
      WHERE id = $1
      AND company_id = $2
      RETURNING *
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Aplicación fitosanitaria no encontrada para esta empresa",
      });
    }

    res.json({
      mensaje: "Aplicación fitosanitaria eliminada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error eliminando aplicación fitosanitaria",
      error: error.message,
    });
  }
};