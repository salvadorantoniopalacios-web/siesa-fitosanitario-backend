import pool from "../config/db.js";

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

export const getAlerts = async (req, res) => {
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
        l.id AS lot_id,
        l.codigo AS lote_codigo,
        f.nombre AS finca_nombre,
        l.cultivo,
        l.estado AS lote_estado,
        e.id AS evaluation_id,
        e.fecha AS fecha_evaluacion,
        e.plaga_enfermedad,
        e.incidencia,
        e.severidad,
        e.nivel_riesgo,
        e.responsable,

        CASE
          WHEN e.id IS NULL THEN 'Crítico'
          WHEN e.nivel_riesgo ILIKE 'Crítico' THEN 'Crítico'
          WHEN e.nivel_riesgo ILIKE 'Alto' THEN 'Alto'
          WHEN e.nivel_riesgo ILIKE 'Medio' THEN 'Medio'
          ELSE 'Bajo'
        END AS nivel_alerta,

        CASE
          WHEN e.id IS NULL THEN 'Urgente'
          WHEN e.nivel_riesgo ILIKE 'Crítico' THEN 'Urgente'
          WHEN e.nivel_riesgo ILIKE 'Alto' THEN 'Alta'
          WHEN e.nivel_riesgo ILIKE 'Medio' THEN 'Media'
          ELSE 'Normal'
        END AS prioridad,

        CASE
          WHEN e.fecha IS NULL THEN NULL
          ELSE CURRENT_DATE - e.fecha::date
        END AS dias_desde_ultima_evaluacion,

        CASE
          WHEN e.id IS NULL THEN 'Lote sin evaluación fitosanitaria registrada'
          WHEN e.nivel_riesgo ILIKE 'Crítico' THEN 'Evaluación con riesgo crítico'
          WHEN e.nivel_riesgo ILIKE 'Alto' THEN 'Evaluación con riesgo alto'
          WHEN e.nivel_riesgo ILIKE 'Medio' THEN 'Evaluación con riesgo medio'
          ELSE 'Lote controlado'
        END AS mensaje_alerta,

        CASE
          WHEN e.id IS NULL THEN 'Realizar evaluación fitosanitaria inicial lo antes posible.'
          WHEN e.nivel_riesgo ILIKE 'Crítico' THEN 'Atención inmediata: revisar lote, documentar hallazgo y definir acción correctiva.'
          WHEN e.nivel_riesgo ILIKE 'Alto' THEN 'Programar seguimiento técnico y reforzar monitoreo del lote.'
          WHEN e.nivel_riesgo ILIKE 'Medio' THEN 'Mantener observación y repetir evaluación según programa.'
          ELSE 'Continuar con monitoreo rutinario.'
        END AS accion_recomendada,

        CASE
          WHEN e.id IS NULL THEN 'Pendiente de evaluación'
          WHEN e.nivel_riesgo ILIKE 'Crítico' THEN 'Requiere intervención inmediata'
          WHEN e.nivel_riesgo ILIKE 'Alto' THEN 'Requiere seguimiento'
          WHEN e.nivel_riesgo ILIKE 'Medio' THEN 'En observación'
          ELSE 'Controlado'
        END AS estado_operativo

      FROM lots l
      LEFT JOIN farms f 
        ON l.farm_id = f.id
        AND f.company_id = $1
      LEFT JOIN LATERAL (
        SELECT *
        FROM evaluations ev
        WHERE ev.lot_id = l.id
        AND ev.company_id = $1
        ORDER BY ev.fecha DESC, ev.id DESC
        LIMIT 1
      ) e ON true
      WHERE l.company_id = $1
      ORDER BY 
        CASE
          WHEN e.id IS NULL THEN 1
          WHEN e.nivel_riesgo ILIKE 'Crítico' THEN 2
          WHEN e.nivel_riesgo ILIKE 'Alto' THEN 3
          WHEN e.nivel_riesgo ILIKE 'Medio' THEN 4
          ELSE 5
        END,
        l.id DESC
      `,
      [companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET ALERTS:", error);

    res.status(500).json({
      mensaje: "Error obteniendo alertas",
      error: error.message,
    });
  }
};