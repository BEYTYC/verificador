import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// En Vite se usa import.meta.env en lugar de process.env
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

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
  // Inicializamos el modelo con la configuración de esquema (Structured Output)
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

  const prompt = `Analiza este PDF que contiene documentos de grado. Debes verificar la presencia y validez de los siguientes 12 requisitos en este orden específico:
1. Formato Verificación de requisitos y aprobación de grado
2. Documento de identidad
3. Comprobante de pago de los derechos de grado
4. Recibo de pago Estampilla Gobernación de Bolívar
5. Diploma o acta de grado
6. Certificado de promedio académico ponderado
7. Balance académico
8. Certificación de inglés
9. Resultados pruebas Saber Pro
10. Formato calificación de grado
11. Opción de grado presentada
12. Evaluación del trabajo de grado

Criterios de validación:
- Requisito 1: firmado por decano facultad ciencias navales, decano académico y director de la escuela.
- Requisito 3: valor de $507.000.
- Requisito 4: valor de $62.344.
- Requisito 5: Pregrado -> Bachiller. Posgrado -> Pregrado.
- Requisito 8: señal emitida por CIEN.
- Requisito 12: Título "EVALUACIÓN TRABAJO DE GRADO", firmado por Jefe de Programa y Decano.

Instrucciones adicionales:
- Nombre: APELLIDOS Y NOMBRES (de la cédula).
- Programa: ÚNICAMENTE del certificado de Estadística.
- foundValue: Seguir las reglas específicas de formato (ej: "$507.000", "B1 - FIRMADO", etc.) explicadas anteriormente.
- No incluyas la palabra "REVISIÓN".`;

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

    const responseText = result.response.text();
    return JSON.parse(responseText) as AnalysisResponse;
    
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Error al analizar los documentos con Gemini. Verifica la API Key y la conexión.");
  }
}
