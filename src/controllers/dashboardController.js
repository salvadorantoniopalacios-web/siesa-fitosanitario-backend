import pool from "../config/db.js";

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const limpiarNombrePlaga = (texto) => {
  if (!texto) return "Sin especificar";

  const sinFoto = String(texto).replace(/\[foto:.*?\]/g, "").trim();
  const sinNumero = sinFoto.replace(/^\d+\.\s*/, "").trim();
  const match = sinNumero.match(/^(.*?)\s*\(/);

  return match ? match[1].trim() : sinNumero;
};

export const getDashboardSummary = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const fincas = await pool.query(
      `
      SELECT COUNT(*) 
      FROM farms
      WHERE company_id = $1
      `,
      [companyId]
    );

    const lotes = await pool.query(
      `
      SELECT COUNT(*) 
      FROM lots
      WHERE company_id = $1
      `,
      [companyId]
    );

    const evaluaciones = await pool.query(
      `
      SELECT COUNT(*) 
      FROM evaluations
      WHERE company_id = $1
      `,
      [companyId]
    );

    const alertas = await pool.query(
      `
      SELECT COUNT(*) 
      FROM evaluations 
      WHERE nivel_riesgo IN ('Alto', 'Crítico')
      AND company_id = $1
      `,
      [companyId]
    );

    const evaluacionesPorRiesgo = await pool.query(
      `
      SELECT 
        nivel_riesgo,
        COUNT(*) AS total
      FROM evaluations
      WHERE company_id = $1
      GROUP BY nivel_riesgo
      ORDER BY total DESC
      `,
      [companyId]
    );

    const incidenciaPorFinca = await pool.query(
      `
      SELECT 
        farms.nombre AS finca,
        ROUND(AVG(evaluations.incidencia)::numeric, 2) AS incidencia_promedio,
        COUNT(evaluations.id) AS total_evaluaciones
      FROM evaluations
      JOIN farms ON farms.id = evaluations.farm_id
      WHERE evaluations.company_id = $1
      GROUP BY farms.nombre
      ORDER BY incidencia_promedio DESC
      LIMIT 10
      `,
      [companyId]
    );

    const tendenciaSemanal = await pool.query(
      `
      SELECT 
        TO_CHAR(DATE_TRUNC('week', fecha), 'YYYY-MM-DD') AS semana,
        ROUND(AVG(incidencia)::numeric, 2) AS incidencia_promedio,
        COUNT(*) AS total_evaluaciones
      FROM evaluations
      WHERE company_id = $1
      GROUP BY DATE_TRUNC('week', fecha)
      ORDER BY semana ASC
      LIMIT 12
      `,
      [companyId]
    );

    const topLotesCriticos = await pool.query(
      `
      SELECT 
        lots.codigo AS lote,
        farms.nombre AS finca,
        lots.cultivo AS cultivo,
        COUNT(evaluations.id) AS total_alertas,
        ROUND(AVG(evaluations.incidencia)::numeric, 2) AS incidencia_promedio
      FROM evaluations
      JOIN lots ON lots.id = evaluations.lot_id
      JOIN farms ON farms.id = evaluations.farm_id
      WHERE evaluations.nivel_riesgo IN ('Alto', 'Crítico')
      AND evaluations.company_id = $1
      GROUP BY lots.codigo, farms.nombre, lots.cultivo
      ORDER BY total_alertas DESC, incidencia_promedio DESC
      LIMIT 10
      `,
      [companyId]
    );

    const plagasRaw = await pool.query(
      `
      SELECT plaga_enfermedad
      FROM evaluations
      WHERE plaga_enfermedad IS NOT NULL
      AND company_id = $1
      `,
      [companyId]
    );

    const conteoPlagas = {};

    plagasRaw.rows.forEach((row) => {
      const partes = String(row.plaga_enfermedad || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

      partes.forEach((parte) => {
        const nombre = limpiarNombrePlaga(parte);

        if (!conteoPlagas[nombre]) {
          conteoPlagas[nombre] = 0;
        }

        conteoPlagas[nombre] += 1;
      });
    });

    const topPlagas = Object.entries(conteoPlagas)
      .map(([plaga, total]) => ({
        plaga,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    res.json({
      fincas: Number(fincas.rows[0].count),
      lotes: Number(lotes.rows[0].count),
      evaluaciones: Number(evaluaciones.rows[0].count),
      alertas: Number(alertas.rows[0].count),
      evaluacionesPorRiesgo: evaluacionesPorRiesgo.rows,
      incidenciaPorFinca: incidenciaPorFinca.rows,
      tendenciaSemanal: tendenciaSemanal.rows,
      topLotesCriticos: topLotesCriticos.rows,
      topPlagas,
    });
  } catch (error) {
    console.error("ERROR DASHBOARD SUMMARY:", error);

    res.status(500).json({
      mensaje: "Error obteniendo resumen dashboard",
      error: error.message,
    });
  }
};