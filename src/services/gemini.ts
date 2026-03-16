import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Inicializamos con la API KEY
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: any[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // USAMOS EL NOMBRE EXACTO QUE GOOGLE PIDE AHORA
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
      { text: "Analiza los documentos de grado en este PDF y devuelve un JSON con personName, academicProgram, checklist y additionalDocuments." },
    ]);

    const text = result.response.text();
    // Limpiamos el texto por si viene con marcas de markdown ```json
    const cleanJson = text.replace(/```json|```/g, "");
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error en la llamada a Gemini:", error);
    throw error;
  }
}
