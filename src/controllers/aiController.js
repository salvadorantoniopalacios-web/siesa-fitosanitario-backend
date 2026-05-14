import { GoogleGenAI } from "@google/genai";

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

    const imagenBase64 = convertirImagenABase64(req.file);

    // 1. Usamos 'gemini-1.5-flash-latest' para forzar que la API lo encuentre
    const respuestaIA = await client.models.generateContent({
      model: "gemini-1.5-flash-latest", 
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Analiza esta imagen fitosanitaria. Responde en español con un análisis técnico breve y recomendaciones."
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

    // 2. Forma correcta de sacar el texto en tu versión de librería
    const textoFinal = respuestaIA.text || 
                       respuestaIA.candidates?.[0]?.content?.parts?.[0]?.text || 
                       "No se pudo generar el análisis.";

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