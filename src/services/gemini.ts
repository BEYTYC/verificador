import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface VerificationResult {
  item: string;
  status: 'present' | 'missing' | 'incomplete';
  foundValue: string; // What was found (e.g., "$507.000", "Anexo", "8.458")
  observations: string;
  pageRange?: string; // e.g., "1-2" or "3"
}

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: VerificationResult[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  const model = ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `Analiza este PDF que contiene documentos de grado. Debes verificar la presencia y validez de los siguientes 12 requisitos en este orden específico:
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

Criterios de validación (úsalos para verificar pero mantén el nombre corto en el JSON):
- Requisito 1: firmado por decano facultad ciencias navales, decano académico y director de la escuela.
- Requisito 2: legible por ambos lados.
- Requisito 3: por valor de $507.000.
- Requisito 4: por valor de $62.344.
- Requisito 5: Si el programa es de pregrado (cualquiera que NO diga especialización, maestría o doctorado), debe ser diploma/acta de Bachiller. Si es de posgrado (especialización, maestría o doctorado), debe ser diploma/acta de Pregrado.
- Requisito 6: firmado por Jefe de Estadística. Vigencia: 5 años (pregrado) o 3 años (posgrado).
- Requisito 7: firmado por jefe de programa y decano - debe tener promedio.
- Requisito 8: señal emitida por CIEN, con nombre del estudiante y firma.
- Requisito 9: Solo obligatorio para pregrado. Para posgrado (especialización, maestría o doctorado) NO es obligatorio.
- Requisito 10: firmado por jefe de programa, decano de facultad y decano académico.
- Requisito 11: certificado de facultad con tipo de trabajo (trabajo, seminario, etc.), firmado por decano.
- Requisito 12: Documento con título "EVALUACIÓN TRABAJO DE GRADO". Debe estar firmado en la página 1 por el Jefe de Programa y Decano de Facultad.

Además:
- Extrae el nombre de la persona de la cédula. El formato debe ser siempre APELLIDOS Y NOMBRES.
- Extrae el programa académico en el que se gradúa (ej: "Administración de Empresas", "Ingeniería de Sistemas", etc.) ÚNICAMENTE del certificado de la Sección de Estadística.
- Identifica cualquier otro documento adicional cargado que no esté en la lista anterior.
- Para cada requisito, indica en "foundValue" lo que se encontró específicamente siguiendo estas reglas:
  * Documento de identidad: Si es una cédula, pon "CÉDULA DE CIUDADANÍA LEGIBLE". Si es un pasaporte, pon "PASAPORTE LEGIBLE".
  * Comprobante de pago: El valor debe ser exactamente $507.000. Si se encuentra pero el valor es diferente, pon "[valor encontrado] - EL VALOR NO CONCUERDA", marca el estado como "incomplete" y explica la discrepancia en observaciones. Si no se encuentra, pon "No se encontró".
  * Estampilla: El valor debe ser exactamente $62.344. Asegúrate de incluir siempre el signo $ al inicio. Si se encuentra pero el valor es diferente, pon "$[valor encontrado] - EL VALOR NO CONCUERDA", marca el estado como "incomplete" y explica la discrepancia en observaciones. Si no se encuentra, pon "No se encontró".
  * Certificación de inglés: Coloca la calificación (ej: "B1", "B2"). IMPORTANTE: Si NO tiene la señal emitida por CIEN, marca el estado como "missing" y pon "No se encontró señal".
  * Diploma o acta de grado: Indica lo que se encontró seguido de la profesión. Si se encontraron ambos, pon "ACTA DE GRADO Y DIPLOMA - [PROFESIÓN]". Si solo uno, pon "ACTA DE GRADO - [PROFESIÓN]" o "DIPLOMA - [PROFESIÓN]". Para pregrado la profesión es "BACHILLER". Para posgrado la profesión es la que indique el diploma/acta de pregrado (ej: "ADMINISTRADOR DE EMPRESAS", "INGENIERO CIVIL").
  * Certificado de promedio ponderado: Añade si está "Firmado" o "No firmado" junto al promedio usando PUNTO como separador decimal (ej: "4.2 - FIRMADO").
  * Balance académico: Pon el promedio usando PUNTO como separador decimal seguido de " - FIRMADO" o " - NO FIRMADO" (ej: "4.1 - FIRMADO").
  * Formato calificación de grado: Extrae el ÚLTIMO NÚMERO que aparece en este documento (esta es la nota de calificación de grado). Pon la nota usando PUNTO como separador decimal seguida de " - FIRMADO" o " - NO FIRMADO" (ej: "4.5 - FIRMADO").
  * Formato Verificación de requisitos: Indica si está "Firmado" o "NO ESTÁ FIRMADO". IMPORTANTE: Este formato contiene dos notas (Calificación de Grado y Calificación de Trabajo de Grado). Debes verificar:
    1. Que la "Calificación de Grado" aquí coincida con la nota del requisito 10.
    2. Que la "Calificación de Trabajo de Grado" aquí coincida con la nota del requisito 12.
    Si alguna NO coincide, pon "NO COINCIDE LA NOTA DE [Nombre de la nota]", marca el estado como "incomplete" (X) y explica la discrepancia en observaciones.
  * Resultados pruebas Saber Pro: Si es posgrado, pon "NO APLICA" y marca como "present". Si es pregrado, pon "INCLUÍDO". IMPORTANTE: Verifica que el programa académico mencionado en los resultados coincida con el programa en el que se va a graduar.
  * Opción de grado presentada: Indica el tipo de opción específica que dice el certificado (ej: "TRABAJO DE GRADO", "SEMINARIO", "MONOGRAFÍA", etc.).
  * Evaluación del trabajo de grado: Este requisito debe constar de DOS (2) formatos firmados. Busca el valor que dice "CALIFICACIÓN TOTAL DEL TRABAJO" (o el valor al lado de 100% en el cuadro de 70%/30%). Pon "ANEXO 2 CALIFICACIONES" seguido de la nota con 3 decimales usando PUNTO como separador (ej: "ANEXO 2 CALIFICACIONES - 6.820").
  * Otros: Usa valores descriptivos cortos.
- EL CRITERIO PARA LOS REQUISITOS DEBE SER EL MISMO PARA TODOS LOS ESTUDIANTES.
- IMPORTANTE: Para cada documento encontrado, indica el rango de páginas (ej: "1-2", "3", "5-7"). Si no se encuentra, deja el campo vacío.
- No incluyas la palabra "REVISIÓN" en ninguna parte de la respuesta.

Responde estrictamente en formato JSON con la siguiente estructura:
{
  "personName": "APELLIDOS Y NOMBRES encontrados",
  "academicProgram": "Nombre del programa académico (de Estadística)",
  "checklist": [
    { "item": "Nombre del requisito", "status": "present" | "missing" | "incomplete", "foundValue": "valor encontrado", "observations": "Detalles encontrados", "pageRange": "rango de páginas" }
  ],
  "additionalDocuments": ["Lista de nombres de documentos extra encontrados"]
}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personName: { type: Type.STRING },
          academicProgram: { type: Type.STRING },
          checklist: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["present", "missing", "incomplete"] },
                foundValue: { type: Type.STRING, description: "Lo que se encontró específicamente para este requisito" },
                observations: { type: Type.STRING },
                pageRange: { type: Type.STRING, description: "Rango de páginas, ej: '1-2' o '5'" }
              },
              required: ["item", "status", "foundValue", "observations"]
            }
          },
          additionalDocuments: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["personName", "academicProgram", "checklist", "additionalDocuments"]
      }
    }
  });

  try {
    const response = await model;
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
