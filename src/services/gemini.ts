import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Configuración de la API Key desde las variables de entorno de Vite
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

/**
 * Función principal para analizar los documentos de grado usando Google Gemini.
 * @param pdfBase64 El archivo PDF convertido a cadena Base64.
 */
export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // Usamos "gemini-1.5-flash" por ser la versión más estable y compatible 
  // con el endpoint de producción actual.
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

  const prompt = `Actúa como un Secretario Académico experto. Tu tarea es analizar rigurosamente este PDF de documentos de grado.
  
  Verifica estos 12 requisitos específicos:
  1. Formato Verificación de requisitos (Debe tener firmas de decanos y director).
  2. Documento de identidad (Cédula legible).
  3. Comprobante de Derechos de grado ($507.000).
  4. Estampilla Procultura Bolívar ($62.344).
  5. Diploma o acta de grado anterior (Bachiller para pregrado / Profesional para posgrado).
  6. Certificado de promedio académico (Debe estar firmado por Jefe de Estadística).
  7. Balance académico (Firmado y con promedio).
  8. Certificación de suficiencia en inglés (CIEN).
  9. Resultados Pruebas Saber Pro (Obligatorio para pregrado).
  10. Formato de calificación de grado (Firmado).
  11. Certificado de opción de grado (Certificado por facultad).
  12. Evaluación trabajo de grado (Anexo 2 con nota numérica).

  INSTRUCCIONES DE EXTRACCIÓN:
  - Extrae el nombre completo del estudiante ÚNICAMENTE de la CÉDULA DE CIUDADANÍA.
  - Extrae el programa académico del certificado de estadística o balance académico.
  - Si falta una firma obligatoria en un documento presente, marca el estado como "incomplete".
  - Indica en 'pageRange' la ubicación exacta dentro del PDF.`;

  try {
    // Verificación de seguridad de la API Key
    if (!API_KEY) {
      throw new Error("La API Key 'VITE_GEMINI_API_KEY' no está configurada. Revisa Netlify o tu archivo .env");
    }

    // Llamada a la IA enviando el PDF y el prompt
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
    
    // Parseo de la respuesta JSON estructurada
    return JSON.parse(text) as AnalysisResponse;
    
  } catch (error: any) {
    console.error("Error detallado en el servicio Gemini:", error);

    // Manejo de errores específicos para guiar al usuario
    if (error.message?.includes("403")) {
        throw new Error("Error 403: La API Key es inválida o ha sido bloqueada (leaked). Por favor, genera una nueva en Google AI Studio.");
    }
    
    if (error.message?.includes("404")) {
        throw new Error("Error 404: El modelo solicitado no fue encontrado. Intenta de nuevo en unos minutos o verifica la configuración.");
    }

    throw new Error("Error al conectar con el verificador. Por favor, revisa la consola del navegador para más detalles.");
  }
}
