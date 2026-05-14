import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        mensaje: "Debe enviar una imagen para analizar.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        mensaje: "No está configurada la API Key de Gemini en el backend.",
      });
    }

    const imagenBase64 = convertirImagenABase64(req.file);

    const respuesta = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
Analiza esta imagen agrícola o fitosanitaria.

Responde en español y con enfoque técnico, pero claro.

IMPORTANTE:
- No des un diagnóstico definitivo.
- Presenta el resultado como una posible observación visual.
- Indica que debe ser validado por un técnico responsable.
- Si la imagen no permite identificar nada, dilo claramente.
- No inventes una plaga si la imagen no tiene suficiente evidencia.

Devuelve este formato:

Posible observación:
Confianza estimada:
Señales visibles:
Recomendación técnica:
Advertencia:
              `,
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

    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: respuesta.text || "No se obtuvo respuesta de Gemini.",
    });
  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);

    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};