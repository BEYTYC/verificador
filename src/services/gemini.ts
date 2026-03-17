import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Vite lee automáticamente las variables que empiezan por VITE_ en Netlify
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: any[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // MODELO ESTABLE: Usamos gemini-1.5-flash para asegurar compatibilidad
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", 
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          personName: { type: SchemaType.STRING },
          academicProgram: { type: SchemaType.STRING },
          checklist: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                item: { type: SchemaType.STRING },
                status: { type: SchemaType.STRING, enum: ["present", "missing", "incomplete"] },
                foundValue: { type: SchemaType.STRING },
                observations: { type: SchemaType.STRING }
              },
              required: ["item", "status", "foundValue", "observations"]
            }
          },
          additionalDocuments: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        },
        required: ["personName", "academicProgram", "checklist", "additionalDocuments"]
      }
    }
  });

  const prompt = `Analiza este PDF de grado y extrae el nombre completo del estudiante, el programa académico y valida los requisitos obligatorios.`;

  try {
    if (!API_KEY) {
      throw new Error("API Key no detectada. Verifica que en Netlify se llame VITE_GEMINI_API_KEY");
    }

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { text: prompt },
    ]);

    return JSON.parse(result.response.text());
  } catch (error: any) {
    console.error("Error en el servicio:", error);
    throw new Error(`Error de conexión: ${error.message}`);
  }
}
