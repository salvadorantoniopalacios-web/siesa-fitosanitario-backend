import { GoogleGenerativeAI } from "@google/generative-ai";

// FORZAMOS LA VERSIÓN ESTABLE V1 PARA EVITAR EL 404 DE LA V1BETA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const convertirImagenABase64 = (file) => {
  return file.buffer.toString("base64");
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debe enviar una imagen." });
    }

    // Especificamos la versión del API explícitamente si es necesario, 
    // pero usualmente cambiar el nombre del modelo a la versión técnica ayuda:
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    }, { apiVersion: 'v1' }); // <--- ESTO FUERZA LA VERSIÓN ESTABLE

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
    
    // Si el 404 persiste, intentamos con el nombre de modelo alternativo
    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};