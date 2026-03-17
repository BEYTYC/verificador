import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// En Vite se debe usar import.meta.env y el prefijo VITE_
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
  // CAMBIO DEFINITIVO: Usamos el nombre base del modelo estable
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

  const prompt = `Actúa como un Secretario Académico experto. Analiza este PDF y valida los 12 requisitos de grado:
  1. Verificación de requisitos (firmas ok).
  2. Cédula/Pasaporte.
  3. Derechos de grado ($507.000).
  4. Estampilla Procultura Bolívar ($62.344).
  5. Diploma/Acta Bachiller o pregrado.
  6. Certificado promedio (Firma Estadística).
  7. Balance académico (Firmado).
  8. Certificación Inglés (CIEN).
  9. Saber Pro.
  10. Formato calificación grado.
  11. Opción de grado.
  12. Calificación trabajo de grado (Anexo 2).

  REGLAS:
  - Extrae el nombre de la cédula.
  - El estado es "incomplete" si falta alguna firma requerida.
  - Responde solo el JSON.`;

  try {
    if (!API_KEY) {
      throw new Error("API Key no encontrada. Revisa tu archivo .env");
    }

    // Enviamos el PDF a Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    return JSON.parse(response.text()) as AnalysisResponse;
    
  } catch (error: any) {
    console.error("Detalle del error:", error);
    
    // Si sigue dando 404, intentamos con el modelo 2.0 que es el futuro
    if (error.message?.includes("404")) {
        throw new Error("El sistema está actualizándose. Por favor intenta de nuevo en un momento o cambia el modelo a 'gemini-2.0-flash'.");
    }

    throw new Error("Error en la validación del documento.");
  }
}
