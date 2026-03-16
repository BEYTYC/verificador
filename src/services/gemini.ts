import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuración de la IA usando la variable de entorno de Vite/Vercel
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

// Definimos la estructura que espera recibir tu App.tsx
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
  // CAMBIO: Se usa "latest" para evitar el error 404 de modelos retirados
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
  });

  const prompt = `
    Analiza este documento de requisitos de grado. 
    Extrae la información y devuélvela estrictamente en este formato JSON:
    {
      "personName": "NOMBRE COMPLETO DEL ESTUDIANTE",
      "academicProgram": "NOMBRE DEL PROGRAMA O CARRERA",
      "checklist": [
        { "item": "Nombre del requisito", "status": "present o missing", "pageRange": "rango de páginas o N/A" }
      ],
      "additionalDocuments": ["lista de otros documentos encontrados"]
    }
    Responde ÚNICAMENTE el objeto JSON, sin texto adicional ni bloques de código markdown.
  `;

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

    const response = await result.response;
    let text = response.text();
    
    // Limpieza robusta del texto por si la IA devuelve ```json ... ```
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedResponse = JSON.parse(text);

    // Aseguramos que los campos existan para evitar errores en el Frontend
    return {
      personName: parsedResponse.personName || "No detectado",
      academicProgram: parsedResponse.academicProgram || "No detectado",
      checklist: parsedResponse.checklist || [],
      additionalDocuments: parsedResponse.additionalDocuments || []
    };

  } catch (error) {
    console.error("Error detallado en el servicio Gemini:", error);
    throw new Error("No se pudo procesar el documento con la IA.");
  }
}
