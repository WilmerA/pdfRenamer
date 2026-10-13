import { OpenRouter } from '@openrouter/sdk';

const client = new OpenRouter({
  apiKey: Bun.env.API_OPEN_ROUTER,
});

export interface AnalysisResult {
  status: 'PROCESADO' | 'PENDIENTE';
  contract: string | 'DESCONOCIDO';
  type: '1.0' | '1.2' | '1.3' | '1.4' | 'DESCONOCIDO';
  fecha: string | 'DESCONOCIDO';
}

export async function getInfo(textFile: string): Promise<AnalysisResult> {
  const completion = await client.chat.send({
    chatRequest: {
      model: 'openrouter/free',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente experto en extracción de metadatos de documentos mineros de la ANM. Tu tarea es analizar el texto suministrado y responder ÚNICAMENTE en formato JSON plano válido, sin bloques de código Markdown ni texto explicativo.'
        },
        {
          role: 'user',
          content: `Analiza el siguiente texto extraído de un documento de la Agencia Nacional de Minería (ANM) y extrae los datos solicitados siguiendo estrictamente las reglas de clasificación.
            ### REGLAS DE CLASIFICACIÓN Y EXTRACCIÓN:
            1. **contract** (Número de contrato o título minero):
              - Localiza el número en el campo "REFERENCIA", "CONTRATO DE CONCESIÓN No.", "TÍTULO MINERO No.", o equivalente (Ejemplos: "4448A", "FKP-122", "GKI-111"). Extrae el código principal del contrato.
            2. **type** (Tipo de documento según sustento o formato):
              - Si el documento es un **CONCEPTO TÉCNICO** (ej. "CONCEPTO TÉCNICO DE EVALUACIÓN INTEGRAL", "CONCEPTO TÉCNICO PARI..."):
                -> Retorna "1.0"
              - Si el documento es un **AUTO DE FISCALIZACIÓN** (ej. "AUTO DE FISCALIZACIÓN INTEGRAL", "AUTO PARI..."):
              - Revisa el texto y el sustento del acto:
                - Si acoge o sustenta en el **Informe de Visita**: retorna "1.4"
                - Si acoge o sustenta en el **Concepto Técnico**: retorna "1.2"
              - Si el documento es un **INFORME DE INSPECCIÓN DE FISCALIZACIÓN INTEGRAL** o **INFORME DE FISCALIZACIÓN INTEGRAL**:
                -> Retorna "1.3"
            3. **fecha**:
              - **REGLA DE EXCLUSIÓN OBLIGATORIA**: NUNCA extraigas la "FECHA DE VIGENCIA" del encabezado/tabla institucional del formato.
              - Extrae la fecha de expedición/emisión del documento y conviértela SIEMPRE al formato estricto 'DDMMAAAA' (8 dígitos numéricos continuos, sin puntos, sin barras ni guiones).
            4. **REGLA DE INCERTIDUMBRE / PENDIENTE**:
              - Si el texto no contiene la información suficiente, si el tipo de documento no coincide con ninguno de los definidos (1.0, 1.2, 1.3, 1.4), o si no logras determinar con certeza el número de contrato o la fecha, establece "status": "PENDIENTE" y asigna "DESCONOCIDO" al campo correspondiente.
              - Si todos los datos se extrajeron con total certeza, establece "status": "PROCESADO".
            ---
            ### FORMATO DE SALIDA REQUERIDO:
            Responde ÚNICAMENTE en formato JSON plano válido, sin bloques de código Markdown y sin texto adicional:
            {
              "status": "PROCESADO" | "PENDIENTE",
              "contract": "código del contrato o DESCONOCIDO",
              "type": "1.0" | "1.2" | "1.3" | "1.4" | "DESCONOCIDO",
              "fecha": "DDMMAAAA o DESCONOCIDO"
            }
            Texto del documento: ${textFile}`,
        },
      ],
    },
  });

  if (completion instanceof ReadableStream) {
    throw new Error('Expected a non-streaming response');
  }

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from AI provider');
  }

 const textContent = typeof content === 'string' ? content : JSON.stringify(content);

  const cleanedText = textContent
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsedData = JSON.parse(cleanedText) as AnalysisResult;
    return parsedData;
  } catch (error) {
    throw new Error(`Error al parsear el JSON de la IA: ${textContent}`);
  }
}
