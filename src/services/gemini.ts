import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Inicialización limpia
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function analyzeGraduationDocuments(pdfBase64: string) {
  // 2. Usar el nombre corto del modelo (el más compatible)
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: "Analiza este documento y extrae: nombre del estudiante, programa académico y lista de requisitos cumplidos. Responde solo en formato JSON." },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // 3. Limpieza de seguridad por si la IA añade etiquetas de texto
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
    
  } catch (error: any) {
    // 4. Esto te dirá en la consola si el problema es la LLAVE o el MODELO
    console.error("Error detallado:", error);
    if (error.message?.includes("API key")) {
        alert("Error: La API Key no es válida o no está configurada en Vercel.");
    }
    throw error;
  }
}
