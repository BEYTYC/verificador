import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: any[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // Usamos gemini-1.5-flash-latest para evitar errores de versión
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          personName: { type: SchemaType.STRING },
          academicProgram: { type: SchemaType.STRING },
          checklist: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT } },
          additionalDocuments: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        },
        required: ["personName", "academicProgram", "checklist", "additionalDocuments"]
      }
    }
  });

  try {
    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { text: "Analiza los documentos de grado." }
    ]);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
