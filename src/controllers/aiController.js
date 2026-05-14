import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debe enviar una imagen." });
    }

    // USAMOS EL MODELO CON EL NOMBRE TÉCNICO COMPLETO
    // Esto suele forzar a la API a encontrarlo cuando el nombre corto falla
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-001" 
    });

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

    // Pasamos los datos en el formato más básico y directo posible
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imagenBase64,
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

    // Si el 404 sigue, te daré la solución final para configurar el proyecto en Google Cloud
    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};