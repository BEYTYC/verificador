import { GoogleGenerativeAI } from "@google/generative-ai";

// Forzamos el uso de la API Key desde las variables de Vite/Vercel
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function analyzeGraduationDocuments(pdfBase64: string) {
  // Usamos el nombre del modelo que Google acepta en todas las regiones ahora
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
  });

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: "Analiza este documento de grado. Extrae el nombre del estudiante, programa y los rangos de páginas de cada requisito. Responde solo con un objeto JSON válido." },
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error en Gemini:", error);
    throw error;
  }
}
