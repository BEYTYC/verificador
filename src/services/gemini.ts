import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: any[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // El nombre "models/gemini-1.5-flash" es el formato oficial para evitar el error 404
  const model = genAI.getGenerativeModel({
    model: "models/gemini-1.5-flash", 
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
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: "Analiza este documento de grado y extrae la información solicitada." },
    ]);

    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Error detallado de Gemini:", error);
    throw error;
  }
}
