import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const convertirImagenABase64 = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};

export const analizarImagenFitosanitaria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        mensaje: "Debe enviar una imagen para analizar.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        mensaje: "No está configurada la API Key de OpenAI en el backend.",
      });
    }

    const imagenBase64 = convertirImagenABase64(req.file);

    const respuesta = await openai.responses.create({
      model: "gpt-5.5-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Analiza esta imagen agrícola o fitosanitaria.

Responde en español y con enfoque técnico, pero claro.

IMPORTANTE:
- No des un diagnóstico definitivo.
- Presenta el resultado como una posible observación visual.
- Indica que debe ser validado por un técnico responsable.
- Si la imagen no permite identificar nada, dilo claramente.

Devuelve este formato:

Posible observación:
Confianza estimada:
Señales visibles:
Recomendación técnica:
Advertencia:
              `,
            },
            {
              type: "input_image",
              image_url: imagenBase64,
            },
          ],
        },
      ],
    });

    res.json({
      mensaje: "Imagen analizada correctamente",
      resultado: respuesta.output_text,
    });
  } catch (error) {
    console.error("ERROR ANALIZANDO IMAGEN IA:", error);

    res.status(500).json({
      mensaje: "Error analizando imagen con IA",
      error: error.message,
    });
  }
};