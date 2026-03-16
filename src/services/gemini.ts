import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function analyzeGraduationDocuments(pdfBase64: string) {
  // Probamos con la versión más compatible para llaves gratuitas
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: "Analiza este PDF y devuelve un resumen en JSON." },
    ]);

    const response = await result.response;
    return JSON.parse(response.text().replace(/```json|```/g, ""));
  } catch (error: any) {
    console.error("Error completo:", error);
    // Si sale error 404 aquí, intenta crear una NUEVA llave en AI Studio
    throw error;
  }
}
