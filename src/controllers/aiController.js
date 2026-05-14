import { GoogleGenAI } from "@google/genai";

// 1. Configuración del cliente según tu versión 2.2.0
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
      return res.status(500).json({ mensaje: "Falta la API Key." });
    }

    const imagenBase64 = convertirImagenABase64(req.file);

    // 2. LA CLAVE: En esta versión se llama así para evitar el 404
    // Se usa el método models.generateContent directamente
    const respuestaIA = await client.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analiza esta imagen fitosanitaria. Responde en español.
              Formato:
              Posible observación:
              Confianza estimada:
              Señales visibles:
              Recomendación técnica:
              Advertencia: Validar con técnico.`
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

    // 3. Extraer el texto correctamente
    // En la 2.2.0, el texto viene en esta propiedad:
    const textoFinal = respuestaIA.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el análisis.";

    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: textoFinal,
    });

  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);
    
    // Si sigue dando 404, es un tema de la región del servidor
    res.status(error.status || 500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};