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

    const evaluacionesResult = await pool.query(
      `
      SELECT 
        evaluations.*,
        farms.nombre AS finca,
        lots.codigo AS lote,
        lots.cultivo AS cultivo
      FROM evaluations
      JOIN farms ON farms.id = evaluations.farm_id
      JOIN lots ON lots.id = evaluations.lot_id
      WHERE evaluations.company_id = $1
      ORDER BY evaluations.id DESC
      `,
      [companyId]
    );

    const fincasResult = await pool.query(
      `
      SELECT id, nombre
      FROM farms
      WHERE company_id = $1
      `,
      [companyId]
    );

    const lotesResult = await pool.query(
      `
      SELECT id, codigo, farm_id, cultivo
      FROM lots
      WHERE company_id = $1
      `,
      [companyId]
    );

    const evaluaciones = evaluacionesResult.rows;
    const fincas = fincasResult.rows;
    const lotes = lotesResult.rows;

    const alertas = evaluaciones.filter((e) =>
      ["Alto", "Crítico"].includes(e.nivel_riesgo)
    );

    const conteoRiesgo = {};

    evaluaciones.forEach((e) => {
      const riesgo = e.nivel_riesgo || "Sin riesgo";
      conteoRiesgo[riesgo] = (conteoRiesgo[riesgo] || 0) + 1;
    });

    const evaluacionesPorRiesgo = Object.entries(conteoRiesgo).map(
      ([nivel_riesgo, total]) => ({
        nivel_riesgo,
        total,
      })
    );

    const incidenciaPorFincaMap = {};

    evaluaciones.forEach((e) => {
      const finca = e.finca || "Sin finca";

      if (!incidenciaPorFincaMap[finca]) {
        incidenciaPorFincaMap[finca] = {
          finca,
          suma: 0,
          total_evaluaciones: 0,
        };
      }

      incidenciaPorFincaMap[finca].suma += Number(e.incidencia || 0);
      incidenciaPorFincaMap[finca].total_evaluaciones += 1;
    });

    const incidenciaPorFinca = Object.values(incidenciaPorFincaMap)
      .map((item) => ({
        finca: item.finca,
        incidencia_promedio: Number(
          (item.suma / item.total_evaluaciones).toFixed(2)
        ),
        total_evaluaciones: item.total_evaluaciones,
      }))
      .sort((a, b) => b.incidencia_promedio - a.incidencia_promedio)
      .slice(0, 10);

    const tendenciaMap = {};

    evaluaciones.forEach((e) => {
      if (!e.fecha) return;

      const fecha = new Date(e.fecha);
      const dia = fecha.getUTCDay();
      const diferencia = dia === 0 ? -6 : 1 - dia;
      fecha.setUTCDate(fecha.getUTCDate() + diferencia);

      const semana = fecha.toISOString().substring(0, 10);

      if (!tendenciaMap[semana]) {
        tendenciaMap[semana] = {
          semana,
          suma: 0,
          total_evaluaciones: 0,
        };
      }

      tendenciaMap[semana].suma += Number(e.incidencia || 0);
      tendenciaMap[semana].total_evaluaciones += 1;
    });

    const tendenciaSemanal = Object.values(tendenciaMap)
      .map((item) => ({
        semana: item.semana,
        incidencia_promedio: Number(
          (item.suma / item.total_evaluaciones).toFixed(2)
        ),
        total_evaluaciones: item.total_evaluaciones,
      }))
      .sort((a, b) => String(a.semana).localeCompare(String(b.semana)))
      .slice(-12);

    const lotesCriticosMap = {};

    alertas.forEach((e) => {
      const key = `${e.lote}-${e.finca}-${e.cultivo}`;

      if (!lotesCriticosMap[key]) {
        lotesCriticosMap[key] = {
          lote: e.lote || "-",
          finca: e.finca || "-",
          cultivo: e.cultivo || "-",
          total_alertas: 0,
          suma: 0,
        };
      }

      lotesCriticosMap[key].total_alertas += 1;
      lotesCriticosMap[key].suma += Number(e.incidencia || 0);
    });

    const topLotesCriticos = Object.values(lotesCriticosMap)
      .map((item) => ({
        lote: item.lote,
        finca: item.finca,
        cultivo: item.cultivo,
        total_alertas: item.total_alertas,
        incidencia_promedio: Number(
          (item.suma / item.total_alertas).toFixed(2)
        ),
      }))
      .sort((a, b) => b.total_alertas - a.total_alertas)
      .slice(0, 10);

    const conteoPlagas = {};

    evaluaciones.forEach((e) => {
      const partes = String(e.plaga_enfermedad || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

      partes.forEach((parte) => {
        const nombre = limpiarNombrePlaga(parte);
        conteoPlagas[nombre] = (conteoPlagas[nombre] || 0) + 1;
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
      fincas: fincas.length,
      lotes: lotes.length,
      evaluaciones: evaluaciones.length,
      alertas: alertas.length,
      evaluacionesPorRiesgo,
      incidenciaPorFinca,
      tendenciaSemanal,
      topLotesCriticos,
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