import { GoogleGenerativeAI, SafetySetting, RespectfulContentSensation, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export interface VerificationItem {
  item: string;
  status: 'present' | 'missing';
  pageRange: string;
}

export interface AnalysisResponse {
  personName: string;
  academicProgram: string;
  checklist: VerificationItem[];
  additionalDocuments: string[];
}

export async function analyzeGraduationDocuments(pdfBase64: string): Promise<AnalysisResponse> {
  // 1. Usamos la versión de modelo estable
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // Si falla "latest", usa este
  }, { apiVersion: 'v1beta' }); // Forzamos v1beta para mejor soporte de PDF

  // 2. Desactivamos filtros de seguridad que bloquean documentos oficiales por error
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

  const prompt = `Analiza este documento de grado. 
    Responde ÚNICAMENTE con un objeto JSON que tenga esta estructura exacta:
    {
      "personName": "Nombre completo",
      "academicProgram": "Programa",
      "checklist": [{ "item": "Nombre", "status": "present", "pageRange": "1" }],
      "additionalDocuments": []
    }`;

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          { text: prompt }
        ]
      }],
      safetySettings
    });

    const response = await result.response;
    let text = response.text();
    
    // 3. Extracción robusta: Buscamos el primer '{' y el último '}' 
    // por si Gemini escribe texto extra.
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("La IA no devolvió un JSON válido");
    }
    
    const jsonString = text.substring(startIdx, endIdx + 1);
    const parsedResponse = JSON.parse(jsonString);

    return {
      personName: parsedResponse.personName || "No detectado",
      academicProgram: parsedResponse.academicProgram || "No detectado",
      checklist: parsedResponse.checklist || [],
      additionalDocuments: parsedResponse.additionalDocuments || []
    };

  } catch (error: any) {
    console.error("Error completo de Gemini:", error);
    
    // Si el error es por cuota (muchos archivos seguidos)
    if (error.message?.includes('429')) {
      throw new Error("Límite de mensajes agotado. Espera un minuto.");
    }
    
    throw new Error("Error al analizar el PDF.");
  }
}
