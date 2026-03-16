import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Nota: Si usas Vite/Vercel cambia a import.meta.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
  // Usamos la versión estable más reciente
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

  const prompt = `Analiza este PDF de documentos de grado. Verifica estos 12 requisitos en orden:
1. Formato Verificación de requisitos y aprobación de grado (Firmas: Decano Ciencias Navales, Académico y Director).
2. Documento de identidad (Legible ambos lados).
3. Comprobante de pago derechos de grado ($507.000).
4. Recibo pago Estampilla Bolívar ($62.344).
5. Diploma/Acta (Pregrado -> Bachiller / Posgrado -> Profesional).
6. Certificado promedio ponderado (Firma Jefe Estadística. Vigencia 5 años pre/3 años pos).
7. Balance académico (Firma jefe programa y decano, con promedio).
8. Certificación inglés (Señal CIEN, nombre y firma).
9. Resultados Saber Pro (Solo pregrado).
10. Formato calificación grado (Firma jefe programa, decano facultad y académico).
11. Opción de grado (Certificado facultad con tipo de trabajo y firma decano).
12. Evaluación trabajo de grado (Título exacto, firmas Pág 1 Jefe Prog y Decano).

REGLAS DE EXTRACCIÓN:
- Nombre: De la cédula, formato APELLIDOS Y NOMBRES.
- Programa: ÚNICAMENTE del certificado de Estadística.
- foundValue: Específico según instrucciones (Ej: "4.2 - FIRMADO", "$507.000", "CÉDULA LEGIBLE").
- Cruce de notas: Verifica que la nota del Requisito 10 y 12 coincidan con las del Requisito 1. Si no coinciden, marcar "incomplete" y avisar en foundValue.
- Saber Pro: Si es posgrado, poner "NO APLICA" y "present".
- Evaluación Trabajo: Debe decir "ANEXO 2 CALIFICACIONES - [nota con 3 decimales]".
- IMPORTANTE: Para cada uno indica el rango de páginas (ej: "1-2").`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error en el servicio Gemini:", error);
    throw new Error("No se pudo analizar el documento. Revisa la consola.");
  }
}
