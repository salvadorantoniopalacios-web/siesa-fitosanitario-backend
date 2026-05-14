import { GoogleGenAI } from "@google/genai";

// 1. Inicializamos la IA con la configuración de objeto que pide la nueva SDK
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debe enviar una imagen." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ mensaje: "Falta la API Key en el servidor." });
    }

    const imagenBase64 = convertirImagenABase64(req.file);

    // 2. EN ESTA SDK: Se usa client.models.generateContent directamente
    // Usamos gemini-1.5-flash porque es el que tiene cuota gratis para Guatemala
    const respuestaIA = await client.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analiza esta imagen agrícola. Responde en español. 
              Formato:
              Posible observación:
              Confianza estimada:
              Señales visibles:
              Recomendación técnica:
              Advertencia: Debe ser validado por un técnico.`
            },
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: imagenBase64,
              },
            },
          ],
        },
      ],
    });

    // 3. Extraer el texto (en la versión 2026 es directo)
    const textoFinal = respuestaIA.text || "No se pudo generar el análisis.";

    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: textoFinal,
    });

  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);
    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};