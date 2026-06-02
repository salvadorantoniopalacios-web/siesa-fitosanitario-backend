import pool from "../config/db.js";
import PDFDocument from "pdfkit";

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

const formatearFecha = () => {
  const fecha = new Date();
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();

  return `${dia}/${mes}/${anio}`;
};

const obtenerImagenBuffer = async (url) => {
  try {
    if (!url || !String(url).startsWith("http")) return null;

    const respuesta = await fetch(url);

    if (!respuesta.ok) return null;

    const arrayBuffer = await respuesta.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
};

const calcularDashboard = async (companyId) => {
  const empresaResult = await pool.query(
    `
    SELECT id, nombre, logo_url
    FROM companies
    WHERE id = $1
    `,
    [companyId]
  );

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
      incidencia_promedio: Number((item.suma / item.total_alertas).toFixed(2)),
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

  return {
    empresa: empresaResult.rows[0] || null,
    fincas: fincas.length,
    lotes: lotes.length,
    evaluaciones: evaluaciones.length,
    alertas: alertas.length,
    evaluacionesPorRiesgo,
    incidenciaPorFinca,
    tendenciaSemanal,
    topLotesCriticos,
    topPlagas,
  };
};

export const getDashboardSummary = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const data = await calcularDashboard(companyId);

    res.json(data);
  } catch (error) {
    console.error("ERROR DASHBOARD SUMMARY:", error);

    res.status(500).json({
      mensaje: "Error obteniendo resumen dashboard",
      error: error.message,
    });
  }
};

export const generateDashboardPdf = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const data = await calcularDashboard(companyId);

    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "inline; filename=reporte-ejecutivo-fitosanitario.pdf"
    );

    doc.pipe(res);

    doc.rect(0, 0, 595.28, 95).fill("#0f172a");

    const logoBuffer = await obtenerImagenBuffer(data.empresa?.logo_url);

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 45, 20, {
          fit: [70, 50],
        });
      } catch {}
    }

    doc
      .fillColor("#ffffff")
      .fontSize(21)
      .font("Helvetica-Bold")
      .text("Reporte Ejecutivo Fitosanitario", 130, 24);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(data.empresa?.nombre || "Empresa", 130, 52)
      .text(`Fecha de emisión: ${formatearFecha()}`, 130, 68);

    let y = 125;

    doc
      .fillColor("#0f172a")
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Resumen general", 45, y);

    y += 28;

    const cardWidth = 118;
    const cardHeight = 65;
    const cards = [
      ["Fincas", data.fincas],
      ["Lotes", data.lotes],
      ["Evaluaciones", data.evaluaciones],
      ["Alertas", data.alertas],
    ];

    cards.forEach((card, index) => {
      const x = 45 + index * 125;

      doc.roundedRect(x, y, cardWidth, cardHeight, 8).fillAndStroke(
        "#f8fafc",
        "#cbd5e1"
      );

      doc
        .fillColor("#64748b")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(card[0], x + 10, y + 12, {
          width: cardWidth - 20,
          align: "center",
        });

      doc
        .fillColor("#0f172a")
        .fontSize(23)
        .font("Helvetica-Bold")
        .text(String(card[1]), x + 10, y + 31, {
          width: cardWidth - 20,
          align: "center",
        });
    });

    y += 100;

    const seccion = (titulo) => {
      doc
        .fillColor("#0f172a")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(titulo, 45, y);

      y += 22;
      doc.moveTo(45, y).lineTo(550, y).strokeColor("#cbd5e1").stroke();
      y += 12;
    };

    const fila = (c1, c2, c3 = "") => {
      if (y > 735) {
        doc.addPage();
        y = 55;
      }

      doc
        .fillColor("#334155")
        .fontSize(9)
        .font("Helvetica")
        .text(String(c1), 45, y, { width: 220 })
        .text(String(c2), 280, y, { width: 100 })
        .text(String(c3), 400, y, { width: 130 });

      y += 18;
    };

    seccion("Top plagas más frecuentes");

    if (data.topPlagas.length === 0) {
      fila("Sin registros", "-", "-");
    } else {
      data.topPlagas.forEach((item) => {
        fila(item.plaga, `Total: ${item.total}`, "");
      });
    }

    y += 18;
    seccion("Incidencia promedio por finca");

    if (data.incidenciaPorFinca.length === 0) {
      fila("Sin registros", "-", "-");
    } else {
      data.incidenciaPorFinca.forEach((item) => {
        fila(
          item.finca,
          `${item.incidencia_promedio}%`,
          `${item.total_evaluaciones} evaluaciones`
        );
      });
    }

    y += 18;
    seccion("Lotes críticos");

    if (data.topLotesCriticos.length === 0) {
      fila("No hay lotes críticos", "-", "-");
    } else {
      data.topLotesCriticos.forEach((item) => {
        fila(
          `${item.lote} / ${item.finca}`,
          `${item.total_alertas} alertas`,
          `${item.incidencia_promedio}%`
        );
      });
    }

    y += 18;
    seccion("Tendencia semanal");

    if (data.tendenciaSemanal.length === 0) {
      fila("Sin registros", "-", "-");
    } else {
      data.tendenciaSemanal.forEach((item) => {
        fila(
          item.semana,
          `${item.incidencia_promedio}%`,
          `${item.total_evaluaciones} evaluaciones`
        );
      });
    }

    doc
      .fillColor("#64748b")
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Reporte generado automáticamente por SIESA Fitosanitario.",
        45,
        800,
        {
          width: 505,
          align: "center",
        }
      );

    doc.end();
  } catch (error) {
    console.error("ERROR GENERANDO PDF DASHBOARD:", error);

    res.status(500).json({
      mensaje: "Error generando reporte ejecutivo",
      error: error.message,
    });
  }
};