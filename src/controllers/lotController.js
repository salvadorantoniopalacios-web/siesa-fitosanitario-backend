import pool from "../config/db.js";
import PDFDocument from "pdfkit";

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const normalizarNumero = (valor) => {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  const numero = Number(valor);

  return Number.isNaN(numero) ? null : numero;
};

const formatearFecha = (fecha) => {
  if (!fecha) return "-";

  const texto = String(fecha).substring(0, 10);
  const partes = texto.split("-");

  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  return texto;
};

const limpiarNombrePlaga = (texto) => {
  if (!texto) return "Sin especificar";

  const sinFoto = String(texto).replace(/\[foto:.*?\]/g, "").trim();
  const sinNumero = sinFoto.replace(/^\d+\.\s*/, "").trim();
  const match = sinNumero.match(/^(.*?)\s*\(/);

  return match ? match[1].trim() : sinNumero;
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

export const getLots = async (req, res) => {
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
        l.id,
        l.codigo,
        l.farm_id,
        f.nombre AS finca_nombre,
        l.cultivo,
        l.variedad,
        l.area_hectareas,
        l.fecha_siembra,
        l.estado,
        l.latitud,
        l.longitud,
        l.company_id,
        l.creado_en
      FROM lots l
      LEFT JOIN farms f ON l.farm_id = f.id
      WHERE l.company_id = $1
      ORDER BY l.id DESC
      `,
      [companyId]
    );

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
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    console.log("DATA LOTE RECIBIDA:", req.body);

    const codigo = req.body.codigo;
    const farm_id = req.body.farm_id || req.body.finca_id;
    const cultivo = req.body.cultivo;
    const variedad = req.body.variedad || null;
    const area_hectareas = req.body.area_hectareas || req.body.area || null;
    const fecha_siembra = req.body.fecha_siembra || null;
    const estado = req.body.estado || "Activo";
    const latitud = normalizarNumero(req.body.latitud);
    const longitud = normalizarNumero(req.body.longitud);

    if (!codigo || !farm_id || !cultivo) {
      return res.status(400).json({
        mensaje: "Código, finca y cultivo son obligatorios",
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
        mensaje: "La finca seleccionada no existe o no pertenece a esta empresa",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO lots (
        codigo,
        farm_id,
        cultivo,
        variedad,
        area_hectareas,
        fecha_siembra,
        estado,
        latitud,
        longitud,
        company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        codigo,
        Number(farm_id),
        cultivo,
        variedad,
        normalizarNumero(area_hectareas),
        fecha_siembra,
        estado,
        latitud,
        longitud,
        companyId,
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
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const codigo = req.body.codigo;
    const farm_id = req.body.farm_id || req.body.finca_id;
    const cultivo = req.body.cultivo;
    const variedad = req.body.variedad || null;
    const area_hectareas = req.body.area_hectareas || req.body.area || null;
    const fecha_siembra = req.body.fecha_siembra || null;
    const estado = req.body.estado || "Activo";
    const latitud = normalizarNumero(req.body.latitud);
    const longitud = normalizarNumero(req.body.longitud);

    if (!codigo || !farm_id || !cultivo) {
      return res.status(400).json({
        mensaje: "Código, finca y cultivo son obligatorios",
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
        mensaje: "La finca seleccionada no existe o no pertenece a esta empresa",
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
        estado = $7,
        latitud = $8,
        longitud = $9
      WHERE id = $10
      AND company_id = $11
      RETURNING *
      `,
      [
        codigo,
        Number(farm_id),
        cultivo,
        variedad,
        normalizarNumero(area_hectareas),
        fecha_siembra,
        estado,
        latitud,
        longitud,
        id,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Lote no encontrado para esta empresa",
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
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM lots
      WHERE id = $1
      AND company_id = $2
      RETURNING *
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Lote no encontrado para esta empresa",
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

export const generateLotPdf = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const empresaResult = await pool.query(
      `
      SELECT nombre, logo_url
      FROM companies
      WHERE id = $1
      `,
      [companyId]
    );

    const loteResult = await pool.query(
      `
      SELECT 
        l.*,
        f.nombre AS finca_nombre,
        f.ubicacion AS finca_ubicacion
      FROM lots l
      LEFT JOIN farms f ON f.id = l.farm_id
      WHERE l.id = $1
      AND l.company_id = $2
      `,
      [id, companyId]
    );

    if (loteResult.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Lote no encontrado para esta empresa",
      });
    }

    const evaluacionesResult = await pool.query(
      `
      SELECT *
      FROM evaluations
      WHERE lot_id = $1
      AND company_id = $2
      ORDER BY fecha ASC, id ASC
      `,
      [id, companyId]
    );

    const aplicacionesResult = await pool.query(
      `
      SELECT *
      FROM applications
      WHERE lot_id = $1
      ORDER BY fecha ASC, id ASC
      `,
      [id]
    );

    const empresa = empresaResult.rows[0] || {};
    const lote = loteResult.rows[0];
    const evaluaciones = evaluacionesResult.rows;
    const aplicaciones = aplicacionesResult.rows;

    const plagasConteo = {};

    evaluaciones.forEach((evaluacion) => {
      const partes = String(evaluacion.plaga_enfermedad || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

      partes.forEach((parte) => {
        const nombre = limpiarNombrePlaga(parte);
        plagasConteo[nombre] = (plagasConteo[nombre] || 0) + 1;
      });
    });

    const topPlagas = Object.entries(plagasConteo)
      .map(([plaga, total]) => ({ plaga, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const incidenciaPromedio =
      evaluaciones.length > 0
        ? Number(
            (
              evaluaciones.reduce(
                (total, item) => total + Number(item.incidencia || 0),
                0
              ) / evaluaciones.length
            ).toFixed(2)
          )
        : 0;

    const alertas = evaluaciones.filter((e) =>
      ["Alto", "Crítico"].includes(e.nivel_riesgo)
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=reporte-lote-${lote.codigo}.pdf`
    );

    doc.pipe(res);

    doc.rect(0, 0, 595.28, 95).fill("#0f172a");

    const logoBuffer = await obtenerImagenBuffer(empresa.logo_url);

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
      .text("Reporte Fitosanitario por Lote", 130, 24);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(empresa.nombre || "Empresa", 130, 52)
      .text(`Lote: ${lote.codigo}`, 130, 68);

    let y = 125;

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Datos generales del lote", 45, y);

    y += 28;

    const agregarFila = (label, valor) => {
      doc
        .fillColor("#334155")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(label, 45, y, { width: 150 });

      doc
        .fillColor("#111827")
        .fontSize(10)
        .font("Helvetica")
        .text(valor || "-", 190, y, { width: 350 });

      y += 20;
    };

    agregarFila("Finca:", lote.finca_nombre);
    agregarFila("Ubicación:", lote.finca_ubicacion);
    agregarFila("Cultivo:", lote.cultivo);
    agregarFila("Variedad:", lote.variedad);
    agregarFila(
      "Área:",
      lote.area_hectareas ? `${lote.area_hectareas} ha` : "-"
    );
    agregarFila("Fecha siembra:", formatearFecha(lote.fecha_siembra));
    agregarFila("Estado:", lote.estado);
    agregarFila(
      "GPS:",
      lote.latitud && lote.longitud
        ? `${lote.latitud}, ${lote.longitud}`
        : "Sin GPS"
    );

    y += 12;

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Resumen fitosanitario", 45, y);

    y += 28;

    const cardWidth = 118;
    const cardHeight = 62;
    const cards = [
      ["Evaluaciones", evaluaciones.length],
      ["Aplicaciones", aplicaciones.length],
      ["Alertas", alertas.length],
      ["Incidencia prom.", `${incidenciaPromedio}%`],
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
        .text(card[0], x + 8, y + 12, {
          width: cardWidth - 16,
          align: "center",
        });

      doc
        .fillColor("#0f172a")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(String(card[1]), x + 8, y + 32, {
          width: cardWidth - 16,
          align: "center",
        });
    });

    y += 95;

    const seccion = (titulo) => {
      if (y > 700) {
        doc.addPage();
        y = 55;
      }

      doc
        .fillColor("#0f172a")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(titulo, 45, y);

      y += 20;
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
        .text(String(c2), 285, y, { width: 110 })
        .text(String(c3), 410, y, { width: 130 });

      y += 18;
    };

    seccion("Top plagas del lote");

    if (topPlagas.length === 0) {
      fila("Sin registros", "-", "-");
    } else {
      topPlagas.forEach((item) => {
        fila(item.plaga, `Total: ${item.total}`, "");
      });
    }

    y += 14;
    seccion("Historial de evaluaciones");

    if (evaluaciones.length === 0) {
      fila("Sin evaluaciones", "-", "-");
    } else {
      evaluaciones.slice(0, 15).forEach((item) => {
        fila(
          formatearFecha(item.fecha),
          `${item.incidencia}% / ${item.severidad || "-"}`,
          item.nivel_riesgo || "-"
        );
      });
    }

    y += 14;
    seccion("Historial de aplicaciones");

    if (aplicaciones.length === 0) {
      fila("Sin aplicaciones", "-", "-");
    } else {
      aplicaciones.slice(0, 15).forEach((item) => {
        fila(
          formatearFecha(item.fecha),
          item.producto_aplicado || "-",
          item.plaga_objetivo || "-"
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
    console.error("ERROR GENERANDO PDF LOTE:", error);

    res.status(500).json({
      mensaje: "Error generando reporte de lote",
      error: error.message,
    });
  }
};