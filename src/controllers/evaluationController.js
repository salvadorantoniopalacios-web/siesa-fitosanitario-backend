import pool from "../config/db.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const calcularNivelRiesgo = (incidencia, severidad) => {
  const valor = Number(incidencia);
  const sev = String(severidad || "").toLowerCase();

  if (valor > 50 && sev === "alta") {
    return "Crítico";
  }

  if (valor > 30 || sev === "alta") {
    return "Alto";
  }

  if (valor >= 10 || sev === "media") {
    return "Medio";
  }

  return "Bajo";
};

const obtenerFotoUrl = (req) => {
  if (!req.file) {
    return null;
  }

  return `/uploads/${req.file.filename}`;
};

const obtenerColorRiesgo = (nivel) => {
  const riesgo = String(nivel || "").toLowerCase();

  if (riesgo === "crítico" || riesgo === "critico") {
    return "#b91c1c";
  }

  if (riesgo === "alto") {
    return "#ea580c";
  }

  if (riesgo === "medio") {
    return "#ca8a04";
  }

  return "#16a34a";
};

const formatearFecha = (fecha) => {
  if (!fecha) {
    return "Sin fecha";
  }

  const date = new Date(fecha);
  return date.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export const getEvaluations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        evaluations.*,
        farms.nombre AS finca,
        lots.codigo AS lote,
        lots.cultivo AS cultivo
      FROM evaluations
      JOIN farms ON farms.id = evaluations.farm_id
      JOIN lots ON lots.id = evaluations.lot_id
      ORDER BY evaluations.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET EVALUATIONS:", error);
    res.status(500).json({
      mensaje: "Error obteniendo evaluaciones",
      error: error.message,
    });
  }
};

export const createEvaluation = async (req, res) => {
  try {
    const {
      fecha,
      farm_id,
      lot_id,
      plaga_enfermedad,
      incidencia,
      severidad,
      observaciones,
      responsable,
    } = req.body;

    const foto_url = obtenerFotoUrl(req);

    console.log("DATA EVALUATION:", req.body);
    console.log("FOTO EVALUATION:", foto_url);

    if (
      !fecha ||
      !farm_id ||
      !lot_id ||
      !plaga_enfermedad ||
      incidencia === "" ||
      incidencia === null ||
      incidencia === undefined ||
      !severidad
    ) {
      return res.status(400).json({
        mensaje:
          "Fecha, finca, lote, plaga/enfermedad, incidencia y severidad son obligatorios",
      });
    }

    const nivel_riesgo = calcularNivelRiesgo(incidencia, severidad);

    const result = await pool.query(
      `
      INSERT INTO evaluations (
        fecha,
        farm_id,
        lot_id,
        plaga_enfermedad,
        incidencia,
        severidad,
        nivel_riesgo,
        observaciones,
        responsable,
        foto_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        plaga_enfermedad,
        Number(incidencia),
        severidad,
        nivel_riesgo,
        observaciones || null,
        responsable || null,
        foto_url,
      ]
    );

    res.json({
      mensaje: "Evaluación creada correctamente",
      nivel_riesgo,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE EVALUATION:", error);
    res.status(500).json({
      mensaje: "Error creando evaluación",
      error: error.message,
    });
  }
};

export const updateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      fecha,
      farm_id,
      lot_id,
      plaga_enfermedad,
      incidencia,
      severidad,
      observaciones,
      responsable,
    } = req.body;

    const nuevaFotoUrl = obtenerFotoUrl(req);

    if (
      !fecha ||
      !farm_id ||
      !lot_id ||
      !plaga_enfermedad ||
      incidencia === "" ||
      incidencia === null ||
      incidencia === undefined ||
      !severidad
    ) {
      return res.status(400).json({
        mensaje:
          "Fecha, finca, lote, plaga/enfermedad, incidencia y severidad son obligatorios",
      });
    }

    const evaluacionActual = await pool.query(
      `
      SELECT foto_url
      FROM evaluations
      WHERE id = $1
      `,
      [id]
    );

    if (evaluacionActual.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Evaluación no encontrada",
      });
    }

    const foto_url = nuevaFotoUrl || evaluacionActual.rows[0].foto_url || null;

    const nivel_riesgo = calcularNivelRiesgo(incidencia, severidad);

    const result = await pool.query(
      `
      UPDATE evaluations
      SET
        fecha = $1,
        farm_id = $2,
        lot_id = $3,
        plaga_enfermedad = $4,
        incidencia = $5,
        severidad = $6,
        nivel_riesgo = $7,
        observaciones = $8,
        responsable = $9,
        foto_url = $10
      WHERE id = $11
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        plaga_enfermedad,
        Number(incidencia),
        severidad,
        nivel_riesgo,
        observaciones || null,
        responsable || null,
        foto_url,
        id,
      ]
    );

    res.json({
      mensaje: "Evaluación actualizada correctamente",
      nivel_riesgo,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE EVALUATION:", error);
    res.status(500).json({
      mensaje: "Error actualizando evaluación",
      error: error.message,
    });
  }
};

export const deleteEvaluation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM evaluations
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Evaluación no encontrada",
      });
    }

    res.json({
      mensaje: "Evaluación eliminada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE EVALUATION:", error);

    if (error.code === "23503") {
      return res.status(409).json({
        mensaje:
          "No se puede eliminar esta evaluación porque tiene registros asociados.",
      });
    }

    res.status(500).json({
      mensaje: "Error eliminando evaluación",
      error: error.message,
    });
  }
};

export const generateEvaluationPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        evaluations.*,
        farms.nombre AS finca,
        farms.ubicacion AS ubicacion_finca,
        farms.area_hectareas AS area_finca,
        farms.cultivo_principal AS cultivo_principal,
        lots.codigo AS lote,
        lots.cultivo AS cultivo
      FROM evaluations
      JOIN farms ON farms.id = evaluations.farm_id
      JOIN lots ON lots.id = evaluations.lot_id
      WHERE evaluations.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Evaluación no encontrada",
      });
    }

    const evaluacion = result.rows[0];
    const colorRiesgo = obtenerColorRiesgo(evaluacion.nivel_riesgo);

    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=evaluacion-fitosanitaria-${id}.pdf`
    );

    doc.pipe(res);

    doc
      .rect(0, 0, 595.28, 85)
      .fill("#0f172a");

    doc
      .fillColor("#ffffff")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("SIESA FITOSANITARIO", 45, 25);

    doc
      .fontSize(11)
      .font("Helvetica")
      .text("Reporte profesional de evaluación fitosanitaria", 45, 52);

    doc
      .fillColor("#0f172a")
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Datos generales de la evaluación", 45, 110);

    doc
      .moveTo(45, 132)
      .lineTo(550, 132)
      .strokeColor("#cbd5e1")
      .stroke();

    let y = 155;

    const agregarFila = (label, valor) => {
      doc
        .fillColor("#334155")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(label, 45, y);

      doc
        .fillColor("#111827")
        .fontSize(10)
        .font("Helvetica")
        .text(valor || "Sin información", 190, y);

      y += 24;
    };

    agregarFila("Fecha:", formatearFecha(evaluacion.fecha));
    agregarFila("Finca:", evaluacion.finca);
    agregarFila("Ubicación:", evaluacion.ubicacion_finca);
    agregarFila("Área finca:", evaluacion.area_finca ? `${evaluacion.area_finca} ha` : null);
    agregarFila("Lote:", evaluacion.lote);
    agregarFila("Cultivo:", evaluacion.cultivo || evaluacion.cultivo_principal);
    agregarFila("Plaga / Enfermedad:", evaluacion.plaga_enfermedad);
    agregarFila("Incidencia:", `${evaluacion.incidencia}%`);
    agregarFila("Severidad:", evaluacion.severidad);

    doc
      .roundedRect(45, y + 5, 505, 54, 8)
      .fillAndStroke("#f8fafc", "#cbd5e1");

    doc
      .fillColor("#334155")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Nivel de riesgo", 65, y + 22);

    doc
      .roundedRect(390, y + 16, 130, 28, 14)
      .fill(colorRiesgo);

    doc
      .fillColor("#ffffff")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(evaluacion.nivel_riesgo || "Sin riesgo", 390, y + 24, {
        width: 130,
        align: "center",
      });

    y += 90;

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Observaciones", 45, y);

    y += 25;

    doc
      .roundedRect(45, y, 505, 90, 8)
      .strokeColor("#cbd5e1")
      .stroke();

    doc
      .fillColor("#111827")
      .fontSize(10)
      .font("Helvetica")
      .text(evaluacion.observaciones || "Sin observaciones registradas.", 60, y + 15, {
        width: 475,
        align: "left",
      });

    y += 120;

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Evidencia fotográfica", 45, y);

    y += 25;

    if (evaluacion.foto_url) {
      const rutaFoto = path.join(process.cwd(), evaluacion.foto_url.replace("/", ""));

      if (fs.existsSync(rutaFoto)) {
        try {
          doc.image(rutaFoto, 45, y, {
            fit: [260, 180],
            align: "center",
            valign: "center",
          });
        } catch (imageError) {
          doc
            .fillColor("#b91c1c")
            .fontSize(10)
            .font("Helvetica")
            .text("No se pudo cargar la imagen en el PDF.", 45, y);
        }
      } else {
        doc
          .fillColor("#64748b")
          .fontSize(10)
          .font("Helvetica")
          .text("La evaluación tiene foto registrada, pero el archivo no fue encontrado.", 45, y);
      }
    } else {
      doc
        .fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica")
        .text("Esta evaluación no tiene evidencia fotográfica registrada.", 45, y);
    }

    doc
      .fillColor("#0f172a")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Responsable", 340, y);

    doc
      .moveTo(340, y + 70)
      .lineTo(535, y + 70)
      .strokeColor("#94a3b8")
      .stroke();

    doc
      .fillColor("#111827")
      .fontSize(10)
      .font("Helvetica")
      .text(evaluacion.responsable || "Sin responsable registrado", 340, y + 78, {
        width: 195,
        align: "center",
      });

    doc
      .fillColor("#64748b")
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Reporte generado automáticamente por SIESA Fitosanitario | Evaluación No. ${evaluacion.id}`,
        45,
        800,
        {
          width: 505,
          align: "center",
        }
      );

    doc.end();
  } catch (error) {
    console.error("ERROR GENERATE EVALUATION PDF:", error);
    res.status(500).json({
      mensaje: "Error generando PDF de evaluación",
      error: error.message,
    });
  }
};