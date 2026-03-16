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
  // CAMBIO CLAVE: Usamos "gemini-1.5-flash" o "gemini-2.0-flash" (el más actual en 2026)
  // Quitar el "-latest" suele solucionar el error 404 en el endpoint v1beta
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

  const prompt = `Analiza detalladamente este PDF de documentos de grado. 
Verifica los siguientes 12 requisitos en este orden:
1. Formato Verificación de requisitos (firmas decanos y director).
2. Documento de identidad (legible).
3. Derechos de grado ($507.000).
4. Estampilla Bolívar ($62.344).
5. Diploma o acta (Bachiller para pregrado / Profesional para posgrado).
6. Certificado promedio (Firma Jefe Estadística).
7. Balance académico (Firmado y con promedio).
8. Certificación inglés (Señal CIEN).
9. Saber Pro (Solo pregrado).
10. Formato calificación grado (Firmado).
11. Opción de grado (Certificado facultad).
12. Evaluación trabajo de grado (Anexo 2 con nota).

INSTRUCCIONES CRÍTICAS:
- Extrae el nombre del estudiante de la CÉDULA (Formato: APELLIDOS Y NOMBRES).
- Extrae el programa ÚNICAMENTE del certificado de ESTADÍSTICA.
- Para "foundValue", sigue los ejemplos: "$507.000", "4.2 - FIRMADO", "CÉDULA LEGIBLE".
- Verifica que la nota del requisito 10 y 12 coincida con lo escrito en el requisito 1. Si no coinciden, marca "incomplete".
- Para cada documento encontrado, indica el rango de páginas (ej: "1-2", "5").`;

  try {
    if (!API_KEY) {
      throw new Error("La API Key 'VITE_GEMINI_API_KEY' no está configurada.");
    }

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
    const text = response.text();
    
    // El modelo ya devuelve JSON puro gracias a responseSchema
    return JSON.parse(text) as AnalysisResponse;
    
  } catch (error: any) {
    console.error("Error en el servicio Gemini:", error);
    
    // Si sigue saliendo 404, el modelo podría haberse actualizado a 2.0
    if (error.message?.includes("404")) {
        throw new Error("Error 404: El modelo solicitado no existe. Intenta cambiar 'gemini-1.5-flash' por 'gemini-2.0-flash' en el código.");
    }

    throw new Error(
      error.message?.includes("403") 
        ? "Error 403: API Key inválida o no configurada en Vercel." 
        : "Error al analizar el documento."
    );
  }
}
