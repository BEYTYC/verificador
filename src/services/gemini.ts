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
  // CAMBIO CLAVE: Usamos "gemini-1.5-flash-latest" para evitar el error 404
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest", 
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
1. Formato Verificación de requisitos (debe tener firmas de decanos y director).
2. Documento de identidad (cédula o pasaporte, debe ser legible).
3. Comprobante Derechos de grado ($507.000).
4. Estampilla Procultura Bolívar ($62.344).
5. Diploma o acta de grado (Bachiller para pregrado / Profesional para posgrado).
6. Certificado de promedio académico (Firma Jefe Estadística).
7. Balance académico (Firmado y con promedio acumulado).
8. Certificación de idioma inglés (Señalización CIEN).
9. Resultados Pruebas Saber Pro (Solo obligatorio para pregrado).
10. Formato calificación de grado (Debe estar firmado).
11. Certificado opción de trabajo de grado (Certificado por facultad).
12. Formato calificación trabajo de grado (Anexo 2 con nota numérica).

INSTRUCCIONES CRÍTICAS:
- Extrae el nombre del estudiante de la CÉDULA (Formato: APELLIDOS Y NOMBRES).
- Extrae el programa académico ÚNICAMENTE del certificado de ESTADÍSTICA o del BALANCE.
- En "foundValue", pon datos específicos: "$507.000", "PROMEDIO: 4.2", "CÉDULA 1047...".
- VALIDACIÓN DE FIRMAS: Si un documento requiere firma y no la tiene, marca status como "incomplete".
- Si el documento no aparece en el PDF, marca status como "missing".
- Indica el rango de páginas donde encontraste cada documento (ej: "Página 1", "3-4").`;

  try {
    if (!API_KEY) {
      throw new Error("La API Key 'VITE_GEMINI_API_KEY' no está configurada en el archivo .env");
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
    
    // Convertimos la respuesta de texto a un objeto JSON real
    return JSON.parse(text) as AnalysisResponse;
    
  } catch (error: any) {
    console.error("Error en el servicio Gemini:", error);
    
    // Manejo de errores específicos
    if (error.message?.includes("404")) {
        throw new Error("Error 404: El modelo solicitado no fue encontrado. Verifica la conexión o intenta con 'gemini-2.0-flash'.");
    }

    if (error.message?.includes("429")) {
        throw new Error("Has agotado la cuota gratuita de Gemini por ahora. Espera un minuto.");
    }

    throw new Error("Error al analizar el documento. Asegúrate de que el PDF sea legible y no sea demasiado pesado.");
  }
}
