import pool from "../config/db.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import cloudinary from "../config/cloudinary.js";

const uploadsDir = path.join(process.cwd(), "uploads");

const calcularNivelRiesgo = (incidencia, severidad) => {
  const valor = Number(incidencia);
  const sev = String(severidad || "").toLowerCase();

  if (valor > 50 && sev === "alta") return "Crítico";
  if (valor > 30 || sev === "alta") return "Alto";
  if (valor >= 10 || sev === "media") return "Medio";

  return "Bajo";
};

const subirImagenCloudinary = (file, carpeta = "siesa-fitosanitario/evaluaciones") => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      resolve(null);
      return;
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: carpeta,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
};

const obtenerRutaFisicaFoto = (fotoUrl) => {
  if (!fotoUrl) return null;

  if (String(fotoUrl).startsWith("http")) {
    return null;
  }

  const nombreArchivo = path.basename(String(fotoUrl));

  return path.join(uploadsDir, nombreArchivo);
};

const obtenerFuenteImagen = async (fotoUrl) => {
  if (!fotoUrl) return null;

  if (String(fotoUrl).startsWith("http")) {
    const respuesta = await fetch(fotoUrl);

    if (!respuesta.ok) {
      return null;
    }

    const arrayBuffer = await respuesta.arrayBuffer();

    return Buffer.from(arrayBuffer);
  }

  const rutaFoto = obtenerRutaFisicaFoto(fotoUrl);

  if (rutaFoto && fs.existsSync(rutaFoto)) {
    return rutaFoto;
  }

  return null;
};

const obtenerFotoUrl = async (req) => {
  if (req.file) {
    return await subirImagenCloudinary(req.file);
  }

  if (req.files?.foto?.[0]) {
    return await subirImagenCloudinary(req.files.foto[0]);
  }

  return null;
};

const obtenerFotosPlagas = async (req) => {
  if (!req.files?.fotos_plagas) return [];

  const urls = [];

  for (const file of req.files.fotos_plagas) {
    const url = await subirImagenCloudinary(
      file,
      "siesa-fitosanitario/evaluaciones/plagas"
    );

    if (url) {
      urls.push(url);
    }
  }

  return urls;
};

const obtenerColorRiesgo = (nivel) => {
  const riesgo = String(nivel || "").toLowerCase();

  if (riesgo === "crítico" || riesgo === "critico") return "#b91c1c";
  if (riesgo === "alto") return "#ea580c";
  if (riesgo === "medio") return "#ca8a04";

  return "#16a34a";
};

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin fecha";

  const fechaTexto = String(fecha).substring(0, 10);
  const [year, month, day] = fechaTexto.split("-");

  if (!year || !month || !day) return "Sin fecha";

  return `${day}/${month}/${year}`;
};

const normalizarNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) {
    return null;
  }

  const numero = Number(valor);

  return Number.isNaN(numero) ? null : numero;
};

const prepararTextoPlagasConFotos = (plagaEnfermedad, fotosPlagas) => {
  if (!plagaEnfermedad || fotosPlagas.length === 0) {
    return plagaEnfermedad;
  }

  const partes = String(plagaEnfermedad)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return partes
    .map((item, index) => {
      const foto = fotosPlagas[index];

      if (!foto) return item;

      return `${item} [foto:${foto}]`;
    })
    .join(" | ");
};

const parsearPlagas = (texto) => {
  if (!texto) return [];

  const partes = String(texto)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return partes.map((item) => {
    const fotoMatch = item.match(/\[foto:(.*?)\]/);
    const foto_url = fotoMatch ? fotoMatch[1].trim() : null;

    const sinFoto = item.replace(/\[foto:.*?\]/, "").trim();
    const limpio = sinFoto.replace(/^\d+\.\s*/, "").trim();

    const match = limpio.match(/^(.*?)\s*\(([\d.]+)%\s*-\s*(.*?)\)$/);

    if (match) {
      return {
        plaga: match[1].trim(),
        incidencia: match[2].trim(),
        severidad: match[3].trim(),
        foto_url,
      };
    }

    return {
      plaga: limpio,
      incidencia: "",
      severidad: "",
      foto_url,
    };
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
    console.log("=================================");
    console.log("CREATE EVALUATION - FILES RECIBIDOS:");
    console.log(req.files);
    console.log("CREATE EVALUATION - BODY RECIBIDO:");
    console.log(req.body);
    console.log("=================================");

    const {
      fecha,
      farm_id,
      lot_id,
      plaga_enfermedad,
      incidencia,
      severidad,
      observaciones,
      responsable,
      latitud,
      longitud,
    } = req.body;

    const foto_url = await obtenerFotoUrl(req);
    const fotosPlagas = await obtenerFotosPlagas(req);

    const plaga_enfermedad_final = prepararTextoPlagasConFotos(
      plaga_enfermedad,
      fotosPlagas
    );

    console.log("FOTO GENERAL CLOUDINARY:", foto_url);
    console.log("FOTOS PLAGAS CLOUDINARY:", fotosPlagas);

    if (
      !fecha ||
      !farm_id ||
      !lot_id ||
      !plaga_enfermedad_final ||
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
        foto_url,
        latitud,
        longitud
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        plaga_enfermedad_final,
        Number(incidencia),
        severidad,
        nivel_riesgo,
        observaciones || null,
        responsable || null,
        foto_url,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
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
    console.log("=================================");
    console.log("UPDATE EVALUATION - FILES RECIBIDOS:");
    console.log(req.files);
    console.log("UPDATE EVALUATION - BODY RECIBIDO:");
    console.log(req.body);
    console.log("=================================");

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
      latitud,
      longitud,
    } = req.body;

    const nuevaFotoUrl = await obtenerFotoUrl(req);
    const fotosPlagas = await obtenerFotosPlagas(req);

    const plaga_enfermedad_final = prepararTextoPlagasConFotos(
      plaga_enfermedad,
      fotosPlagas
    );

    if (
      !fecha ||
      !farm_id ||
      !lot_id ||
      !plaga_enfermedad_final ||
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
        foto_url = $10,
        latitud = $11,
        longitud = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        plaga_enfermedad_final,
        Number(incidencia),
        severidad,
        nivel_riesgo,
        observaciones || null,
        responsable || null,
        foto_url,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
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
    const plagas = parsearPlagas(evaluacion.plaga_enfermedad);

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

    doc.rect(0, 0, 595.28, 85).fill("#0f172a");

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

    doc.moveTo(45, 132).lineTo(550, 132).strokeColor("#cbd5e1").stroke();

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
        .text(valor || "Sin información", 190, y, {
          width: 340,
        });

      y += 22;
    };

    agregarFila("Fecha:", formatearFecha(evaluacion.fecha));
    agregarFila("Finca:", evaluacion.finca);
    agregarFila("Ubicación:", evaluacion.ubicacion_finca);
    agregarFila(
      "Área finca:",
      evaluacion.area_finca ? `${evaluacion.area_finca} ha` : null
    );
    agregarFila("Lote:", evaluacion.lote);
    agregarFila("Cultivo:", evaluacion.cultivo || evaluacion.cultivo_principal);
    agregarFila(
      "GPS evaluación:",
      evaluacion.latitud && evaluacion.longitud
        ? `${evaluacion.latitud}, ${evaluacion.longitud}`
        : "Sin GPS registrado"
    );

    y += 10;

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Detalle de plagas o enfermedades", 45, y);

    y += 25;

    doc.roundedRect(45, y, 505, 26, 6).fill("#e2e8f0");

    doc
      .fillColor("#0f172a")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("No.", 55, y + 8, { width: 35 })
      .text("Plaga / Enfermedad", 90, y + 8, { width: 210 })
      .text("Incidencia", 315, y + 8, { width: 75, align: "center" })
      .text("Severidad", 395, y + 8, { width: 75, align: "center" })
      .text("Foto", 475, y + 8, { width: 60, align: "center" });

    y += 26;

    if (plagas.length > 0) {
      plagas.forEach((item, index) => {
        const altoFila = 28;

        doc.roundedRect(45, y, 505, altoFila, 2).strokeColor("#e2e8f0").stroke();

        doc
          .fillColor("#334155")
          .fontSize(9)
          .font("Helvetica")
          .text(String(index + 1), 55, y + 9, { width: 35 })
          .text(item.plaga || "-", 90, y + 9, { width: 210 })
          .text(item.incidencia ? `${item.incidencia}%` : "-", 315, y + 9, {
            width: 75,
            align: "center",
          })
          .text(item.severidad || "-", 395, y + 9, {
            width: 75,
            align: "center",
          })
          .text(item.foto_url ? "Sí" : "No", 475, y + 9, {
            width: 60,
            align: "center",
          });

        y += altoFila;
      });
    } else {
      doc
        .fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica")
        .text("Sin detalle de plagas registrado.", 55, y + 10);

      y += 30;
    }

    y += 12;

    doc.roundedRect(45, y, 505, 62, 8).fillAndStroke("#f8fafc", "#cbd5e1");

    doc
      .fillColor("#334155")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Promedio de incidencia:", 65, y + 16);

    doc
      .fillColor("#111827")
      .fontSize(10)
      .font("Helvetica")
      .text(`${evaluacion.incidencia}%`, 205, y + 16);

    doc
      .fillColor("#334155")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Severidad global:", 65, y + 38);

    doc
      .fillColor("#111827")
      .fontSize(10)
      .font("Helvetica")
      .text(evaluacion.severidad || "Sin información", 205, y + 38);

    doc.roundedRect(390, y + 17, 130, 30, 15).fill(colorRiesgo);

    doc
      .fillColor("#ffffff")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(evaluacion.nivel_riesgo || "Sin riesgo", 390, y + 26, {
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

    doc.roundedRect(45, y, 505, 85, 8).strokeColor("#cbd5e1").stroke();

    doc
      .fillColor("#111827")
      .fontSize(10)
      .font("Helvetica")
      .text(
        evaluacion.observaciones || "Sin observaciones registradas.",
        60,
        y + 15,
        {
          width: 475,
          align: "left",
        }
      );

    y += 115;

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Evidencia fotográfica general", 45, y);

    y += 25;

    if (evaluacion.foto_url) {
      const fuenteFoto = await obtenerFuenteImagen(evaluacion.foto_url);

      if (fuenteFoto) {
        try {
          doc.image(fuenteFoto, 45, y, {
            fit: [240, 140],
            align: "center",
            valign: "center",
          });
        } catch (imageError) {
          doc
            .fillColor("#b91c1c")
            .fontSize(10)
            .font("Helvetica")
            .text("No se pudo cargar la imagen general en el PDF.", 45, y);
        }
      } else {
        doc
          .fillColor("#64748b")
          .fontSize(10)
          .font("Helvetica")
          .text(
            "La evaluación tiene foto general registrada, pero el archivo no fue encontrado.",
            45,
            y
          );
      }
    } else {
      doc
        .fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica")
        .text("Esta evaluación no tiene foto general registrada.", 45, y);
    }

    const plagasConFoto = plagas.filter((p) => p.foto_url);

    if (plagasConFoto.length > 0) {
      doc.addPage();
      y = 45;

      doc
        .fillColor("#0f172a")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Evidencia fotográfica por plaga", 45, y);

      y += 35;

      for (let index = 0; index < plagasConFoto.length; index++) {
        const plaga = plagasConFoto[index];
        const fuenteFoto = await obtenerFuenteImagen(plaga.foto_url);

        doc
          .fillColor("#0f172a")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(`${index + 1}. ${plaga.plaga}`, 45, y);

        y += 18;

        doc
          .fillColor("#334155")
          .fontSize(9)
          .font("Helvetica")
          .text(
            `Incidencia: ${plaga.incidencia}% | Severidad: ${plaga.severidad}`,
            45,
            y
          );

        y += 15;

        if (fuenteFoto) {
          try {
            doc.image(fuenteFoto, 45, y, {
              fit: [250, 150],
            });
          } catch (error) {
            doc
              .fillColor("#b91c1c")
              .fontSize(10)
              .font("Helvetica")
              .text("No se pudo cargar la foto de esta plaga.", 45, y);
          }
        } else {
          doc
            .fillColor("#64748b")
            .fontSize(10)
            .font("Helvetica")
            .text("Foto no encontrada en servidor.", 45, y);
        }

        y += 185;

        if (y > 650 && index < plagasConFoto.length - 1) {
          doc.addPage();
          y = 45;
        }
      }
    }

    doc
      .fillColor("#0f172a")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Responsable", 340, 685);

    doc.moveTo(340, 755).lineTo(535, 755).strokeColor("#94a3b8").stroke();

    doc
      .fillColor("#111827")
      .fontSize(10)
      .font("Helvetica")
      .text(evaluacion.responsable || "Sin responsable registrado", 340, 763, {
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