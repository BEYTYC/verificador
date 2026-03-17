import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Intentamos obtener la clave con ambos nombres posibles
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: any[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // MODELO ESTABLE: Usamos gemini-1.5-flash para evitar el error 404 de modelos beta
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

  const prompt = `Analiza este PDF de grado y extrae: nombre del estudiante, programa y validación de requisitos.`;

  try {
    if (!API_KEY) {
      throw new Error("ERROR CRÍTICO: No se detectó ninguna API KEY. Verifica que el nombre en Netlify coincida con el código.");
    }

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { text: prompt },
    ]);

    return JSON.parse(result.response.text());
  } catch (error: any) {
    console.error("Detalle técnico:", error);
    throw new Error(`Fallo en la conexión: ${error.message}`);
  }
}
