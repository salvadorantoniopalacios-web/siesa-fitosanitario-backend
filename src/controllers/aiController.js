import { GoogleGenAI } from "@google/genai";

// 1. Instanciamos la IA
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

    // 2. Accedemos al modelo correctamente para la versión @google/genai
    // Usamos gemini-1.5-flash que es el que tiene cuota gratis activa para Guatemala
    const model = ai.models.get("gemini-1.5-flash");

    const imagenBase64 = convertirImagenABase64(req.file);

    const prompt = `
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
`;

    // 3. Ejecutamos la consulta
    const respuestaIA = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
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

    // 4. Extraemos el texto del resultado
    // En esta SDK, el texto está directamente en response.text
    const textoFinal = respuestaIA.response.text;

    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: textoFinal || "No se obtuvo respuesta de Gemini.",
    });

  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);

    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};