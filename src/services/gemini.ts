import { GoogleGenerativeAI } from "@google/generative-ai";

// Forzamos el uso de la API Key desde las variables de Vite/Vercel
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

// Estas interfaces son necesarias para que App.tsx no de error de compilación
export interface VerificationItem {
  item: string;
  status: 'present' | 'missing';
  pageRange: string;
}

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: VerificationItem[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // UNICO CAMBIO IMPORTANTE: agregamos "-latest" para evitar el error 404
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
      { text: "Analiza este documento de grado. Extrae el nombre del estudiante, programa y los rangos de páginas de cada requisito. Responde solo con un objeto JSON válido que contenga las llaves: personName, academicProgram, checklist (con item, status, pageRange) y additionalDocuments." },
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Limpieza de etiquetas markdown si la IA las pone
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error en Gemini:", error);
    throw error;
  }
}
