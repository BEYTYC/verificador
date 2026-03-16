import { GoogleGenerativeAI } from "@google/generative-ai";

// Forzamos el uso de la API Key desde las variables de Vite/Vercel
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function analyzeGraduationDocuments(pdfBase64: string) {
  // CAMBIO: Se usa "gemini-1.5-flash-latest" para asegurar compatibilidad con la API v1beta/v1
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
  });

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { 
        text: "Analiza este documento de grado. Extrae el nombre del estudiante, programa y los rangos de páginas de cada requisito. Responde únicamente con el objeto JSON puro, sin bloques de código markdown." 
      },
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Limpieza más robusta para asegurar que JSON.parse no falle
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error detallado en Gemini:", error);
    throw error;
  }
}
