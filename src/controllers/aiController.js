import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicialización con la librería oficial
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debe enviar una imagen." });
    }

    // Usamos gemini-1.5-flash (el estándar que sí tiene cuota en Guatemala)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imagenBase64 = convertirImagenABase64(req.file);

    const prompt = `
Analiza esta imagen fitosanitaria. Responde en español.
Formato:
Posible observación:
Confianza estimada:
Señales visibles:
Recomendación técnica:
Advertencia: Validar con un técnico.
`;

    // Generar contenido con la sintaxis correcta
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imagenBase64,
          mimeType: req.file.mimetype,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: text,
    });

  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);
    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};