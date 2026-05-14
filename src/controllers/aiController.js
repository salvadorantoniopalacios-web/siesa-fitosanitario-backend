import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Inicialización con la librería estándar (la más estable)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debe enviar una imagen." });
    }

    // 2. Usamos el modelo 1.5 Flash (Gratis en Guatemala)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imagenBase64 = convertirImagenABase64(req.file);

    const prompt = `
Analiza esta imagen fitosanitaria. Responde en español.
Formato:
Posible observación:
Confianza estimada:
Señales visibles:
Recomendación técnica:
Advertencia: Validar con técnico.
`;

    // 3. Estructura de envío de imagen clásica
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
    
    // Si da 404, es que Google quiere que uses el nombre técnico largo
    if (error.message.includes("404")) {
        return res.status(404).json({
            mensaje: "Error de configuración de modelo.",
            sugerencia: "Prueba cambiando el modelo a 'gemini-1.5-flash-latest' en el código."
        });
    }

    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};