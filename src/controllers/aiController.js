import { GoogleGenAI } from "@google/genai";

// Configuración del cliente
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    // 1. Validaciones iniciales
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

    // 2. Definir el modelo correctamente (Usa 1.5 Flash para evitar el error de cuota 429)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imagenBase64 = convertirImagenABase64(req.file);

    // 3. Estructurar el contenido para la IA
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

    const partes = [
      { text: prompt },
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imagenBase64,
        },
      },
    ];

    // 4. Ejecutar la generación de contenido
    const resultadoIA = await model.generateContent(partes);
    const respuesta = await resultadoIA.response;
    const texto = respuesta.text();

    // 5. Enviar respuesta al frontend
    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: texto || "No se obtuvo respuesta de Gemini.",
    });

  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);

    // Manejo específico de errores de cuota (429)
    if (error.status === 429) {
        return res.status(429).json({
            mensaje: "Se ha agotado el límite gratuito momentáneamente. Intenta en 1 minuto.",
            error: error.message
        });
    }

    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};