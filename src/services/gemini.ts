import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface VerificationResult {
  item: string;
  status: 'present' | 'missing' | 'incomplete';
  foundValue: string;
  observations: string;
  pageRange?: string;
}

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: VerificationResult[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // CAMBIO A GEMINI 2.0 FLASH: Es más rápido y evita el error 404 de la v1beta
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", 
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
                observations: { type: SchemaType.STRING },
                pageRange: { type: SchemaType.STRING }
              },
              required: ["item", "status", "foundValue", "observations"]
            }
          },
          additionalDocuments: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          }
        },
        required: ["personName", "academicProgram", "checklist", "additionalDocuments"]
      }
    }
  });

  const prompt = `Actúa como Secretario Académico. Analiza este PDF y valida los 12 requisitos:
  1. Verificación requisitos (firmas). 2. Cédula. 3. Derechos grado ($507.000). 
  4. Estampilla Bolívar ($62.344). 5. Acta Bachiller/Pregrado. 6. Certificado promedio. 
  7. Balance académico. 8. Inglés. 9. Saber Pro. 10. Calificación grado. 
  11. Opción grado. 12. Nota trabajo grado.
  
  EXTRACCIÓN: Nombre de la cédula y Programa del certificado de estadística.`;

  try {
    if (!API_KEY) throw new Error("API Key no configurada.");

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    return JSON.parse(text) as AnalysisResponse;
    
  } catch (error: any) {
    console.error("Error detallado:", error);
    throw new Error("Error al conectar con el verificador. Revisa la consola.");
  }
}
