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
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente experto en extracción de metadatos de documentos mineros de la ANM. Tu tarea es analizar el texto suministrado y responder ÚNICAMENTE en formato JSON plano válido, sin bloques de código Markdown ni texto explicativo.'
        },
        {
          role: 'user',
          content: `Analiza el texto extraído de un documento de la Agencia Nacional de Minería (ANM). Extrae los datos solicitados y responde exclusivamente con un JSON válido que cumpla el esquema definido al final.

          ## REGLAS GENERALES

          1. No inventes datos ni completes información por suposición.
          2. Utiliza el contenido real del documento recibido. No copies datos del ejemplo de referencia.
          3. La posición de un dato en el documento tiene prioridad sobre la coincidencia de una fecha con un patrón genérico.
          4. Distingue entre la fecha de expedición del documento y las fechas históricas o administrativas mencionadas en su contenido.
          5. Para determinar 'fecha', utiliza exclusivamente las reglas específicas de cada categoría documental.
          6. No selecciones una fecha por aparecer primero en el texto ni por coincidir con una fecha utilizada en ejemplos anteriores.

          ## 1. EXTRACCIÓN DEL CONTRATO

          Extrae el código principal del título minero asociado al documento.

          Busca expresiones como:
          - REFERENCIA
          - CONTRATO DE CONCESIÓN No.
          - TÍTULO MINERO No.
          - CONTRATO DE CONCESIÓN seguido de un código.

          Ejemplos:
          - 'Contrato de Concesión No. 4448A (Ley 685 de 2001)' → '4448A'
          - 'CONTRATO DE CONCESIÓN (L 685) ECC-082' → 'ECC-082'
          - 'Contrato de Concesión No. FLV-10V (L 685)' → 'FLV-10V'

          Extrae únicamente el código del contrato. No incluyas palabras como 'No.', referencias legales ni puntuación adicional.

          Si no puedes identificar con certeza el código, devuelve 'DESCONOCIDO'.

          ## 2. CLASIFICACIÓN DEL DOCUMENTO — MATRIZ DE DECISIÓN OBLIGATORIA

          **REGLA FUNDAMENTAL: el tipo de documento se determina por su naturaleza principal, no por la aparición de palabras clave aisladas.**

          Existen exactamente cuatro categorías:

          - '1.0' = Concepto Técnico.
          - '1.2' = Auto de fiscalización que acoge un Concepto Técnico.
          - '1.3' = Informe de inspección o Informe de fiscalización integral.
          - '1.4' = Auto de fiscalización que acoge un Informe de Visita.

          Nunca intercambies estas categorías.

          ### PASO 1. IDENTIFICAR EL DOCUMENTO PRINCIPAL

          Examina el título principal del documento, normalmente ubicado en el encabezado de la primera página.

          Aplica las siguientes reglas en este orden:

          **CASO A — TIPO '1.0': CONCEPTO TÉCNICO**

          Si el documento principal se titula 'CONCEPTO TÉCNICO DE EVALUACIÓN INTEGRAL', 'CONCEPTO TÉCNICO PARI' o una variante equivalente de concepto técnico, asigna:

          '"type": "1.0"'

          Esta regla se aplica aunque el documento mencione autos de fiscalización, informes de visita u otros documentos administrativos en sus antecedentes.

          **IMPORTANTE:** la expresión 'CONCEPTO TÉCNICO' por sí sola NO significa '1.2'. Un concepto técnico independiente siempre corresponde a '1.0'.

          **CASO B — TIPO '1.3': INFORME DE INSPECCIÓN O FISCALIZACIÓN**

          Si el documento principal se titula 'INFORME DE INSPECCIÓN DE FISCALIZACIÓN INTEGRAL', 'INFORME DE FISCALIZACIÓN INTEGRAL' o una variante equivalente de informe de inspección o fiscalización, asigna:

          '"type": "1.3"'

          Esta regla se aplica aunque el informe mencione conceptos técnicos o autos en su contenido.

          **CASO C — AUTO DE FISCALIZACIÓN**

          Si el documento principal se titula 'AUTO DE FISCALIZACIÓN INTEGRAL', 'AUTO DE FISCALIZACIÓN' o una variante equivalente, NO asignes todavía el tipo. Continúa con el paso 2.

          La palabra 'AUTO' debe identificar el documento que estás procesando, no un auto anterior mencionado en el texto.

          ### PASO 2. CLASIFICAR EL AUTO SEGÚN EL DOCUMENTO QUE ACOGE

          Este paso se ejecuta únicamente si el documento principal es un AUTO DE FISCALIZACIÓN.

          Debes identificar qué documento técnico acoge expresamente el auto en sus disposiciones o cuál se identifica inequívocamente como fundamento de la decisión.

          **CASO C1 — TIPO '1.2': AUTO QUE ACOGE UN CONCEPTO TÉCNICO**

          Asigna '1.2' solamente cuando se cumplan ambas condiciones:

          1. El documento principal es un AUTO DE FISCALIZACIÓN.
          2. El auto indica que acoge un documento identificado como 'CONCEPTO TÉCNICO', 'CONCEPTO TÉCNICO DE EVALUACIÓN INTEGRAL' o una variante equivalente.

          Ejemplos de evidencia válida:

          - 'A través del presente acto se acoge el Concepto Técnico ...'
          - 'Se acoge el Concepto Técnico ...'
          - 'El presente auto acoge el Concepto Técnico ...'

          Si se cumplen ambas condiciones, asigna:

          '"type": "1.2"'

          No asignes '1.2' a un documento cuyo título principal sea un concepto técnico independiente.

          **CASO C2 — TIPO '1.4': AUTO QUE ACOGE UN INFORME DE VISITA**

          Asigna '1.4' solamente cuando se cumplan ambas condiciones:

          1. El documento principal es un AUTO DE FISCALIZACIÓN.
          2. El auto indica que acoge un documento identificado como 'INFORME DE VISITA DE FISCALIZACIÓN INTEGRAL', 'INFORME DE VISITA' o una variante equivalente que identifique inequívocamente un informe de visita.

          Ejemplos de evidencia válida:

          - 'A través del presente acto se acoge el Informe de Visita de Fiscalización Integral ...'
          - 'Se acoge el Informe de Visita ...'
          - 'El presente auto acoge el Informe de Visita de Fiscalización Integral ...'

          Si se cumplen ambas condiciones, asigna:

          '"type": "1.4"'

          ### PASO 3. RESOLVER MENCIONES CONTRADICTORIAS

          Un mismo documento puede mencionar conceptos técnicos e informes de visita sin que ambos sean el fundamento del auto actual.

          Aplica estas reglas:

          - Si el documento principal es un concepto técnico, devuelve '1.0', aunque se mencionen autos que acogen conceptos técnicos.
          - Si el documento principal es un informe de fiscalización o inspección, devuelve '1.3', aunque se mencionen conceptos técnicos.
          - Si el documento principal es un auto y su disposición expresa que acoge un Concepto Técnico, devuelve '1.2'.
          - Si el documento principal es un auto y su disposición expresa que acoge un Informe de Visita, devuelve '1.4'.
          - Si el auto acoge expresamente un Informe de Visita y menciona un Concepto Técnico en los antecedentes, conserva '1.4'.
          - Si el auto acoge expresamente un Concepto Técnico y menciona un Informe de Visita en los antecedentes, conserva '1.2'.

          La clasificación debe basarse en la relación entre el documento principal y el documento técnico acogido. No cuentes palabras clave ni elijas la categoría según cuál término aparezca más veces.

          ### REGLA CRÍTICA: NO CONFUNDIR UNA VISITA CON UN INFORME DE VISITA

          La palabra 'VISITA', 'INSPECCIÓN' o expresiones similares NO son suficientes para asignar el tipo '1.4'.

          Para asignar '1.4', debe existir evidencia de que el AUTO DE FISCALIZACIÓN acoge o incorpora como fundamento un documento identificado como 'INFORME DE VISITA' o 'INFORME DE VISITA DE FISCALIZACIÓN INTEGRAL'.

          No clasifiques como '1.4' cuando esas palabras aparezcan únicamente en expresiones como:

          - La Agencia podrá programar una futura visita de inspección.
          - Se recomienda realizar una visita de inspección.
          - En los antecedentes se menciona una visita anterior.
          - Se cita un informe de visita asociado a un acto administrativo anterior.

          Si una disposición del auto expresa que se acoge un 'CONCEPTO TÉCNICO', y las menciones a visitas o inspecciones son incidentales, el tipo obligatorio es '1.2'.

          **Caso de validación:** si el documento dice 'AUTO DE FISCALIZACIÓN INTEGRAL' y en sus disposiciones dice 'se acoge el concepto técnico GSC-ZC No. 000098', mientras que otra disposición menciona que la ANM podrá programar una visita de inspección, el resultado debe ser '"type": "1.2"', nunca '"type": "1.4"'.

          La mención a una visita futura no puede invalidar la identificación explícita del Concepto Técnico acogido.

          ### PASO 4. SI NO EXISTE EVIDENCIA SUFICIENTE

          Si identificas un AUTO DE FISCALIZACIÓN, pero no puedes determinar si acoge un Concepto Técnico o un Informe de Visita, asigna:

          '"type": "DESCONOCIDO"'

          No adivines ni infieras la categoría a partir del nombre del archivo, del número del auto o de menciones incidentales.

          ### PASO 5. VALIDACIÓN OBLIGATORIA ANTES DE RESPONDER

          Comprueba la clasificación con esta matriz:

          | Documento principal                 | Condición                    | Tipo  |
          |-------------------------------------|------------------------------|-------|
          | Concepto Técnico                    | Independiente, no es un auto | '1.0' |
          | Auto de Fiscalización               | Acoge Concepto Técnico       | '1.2' |
          | Informe de Inspección/Fiscalización | Es el documento principal    | '1.3' |
          | Auto de Fiscalización               | Acoge Informe de Visita      | '1.4' |

          Verifica especialmente lo siguiente:

          - Si asignaste '1.2', confirma que el documento principal sea un auto y no un concepto técnico independiente.
          - Si asignaste '1.4', confirma que el documento principal sea un auto y que el documento acogido sea un Informe de Visita.
          - Si el documento principal es un Concepto Técnico independiente, el resultado obligatorio es '1.0', nunca '1.2'.
          - Si el documento principal es un Informe de Inspección o Fiscalización Integral independiente, el resultado obligatorio es '1.3', nunca '1.2' ni '1.4'.

          Si el resultado no cumple estas reglas, corrige el campo 'type' antes de generar el JSON.

          Si la clasificación continúa siendo ambigua, devuelve '"type": "DESCONOCIDO"' y '"status": "PENDIENTE"'.

          ## 3. EXTRACCIÓN DE LA FECHA DE EXPEDICIÓN

          Este campo es crítico. Debes seleccionar la fecha de acuerdo con la categoría documental, siguiendo estrictamente las reglas siguientes.

          ### A. DOCUMENTOS DE TIPO 1.0, 1.2 Y 1.4

          La fecha correcta es la que aparece en el encabezado de la primera página, junto al nombre de una ciudad o municipio, inmediatamente antes de la tabla que contiene el campo 'REFERENCIA'.

          Busca una estructura similar a:

          'Bogotá 29/01/2026'

          O bien:

          'Bogotá, D.C., 29 de enero de 2026'

          La fecha situada en este encabezado es la fecha de expedición que debes extraer.

          **Prioridad obligatoria:** si existe una fecha junto a una ciudad en la ubicación descrita, utiliza esa fecha aunque existan otras fechas en el documento.

          No utilices:
          - La fecha de vigencia del formato.
          - La fecha de firma del contrato.
          - La fecha de registro minero.
          - Las fechas de visitas, inspecciones o actuaciones anteriores.
          - Fechas que aparezcan en tablas, párrafos, antecedentes o páginas posteriores.
          - Fechas de elaboración de otros informes que se mencionen en el documento.

          No confundas el número del auto, del concepto técnico o del informe con una fecha.

          ### B. DOCUMENTOS DE TIPO 1.3

          Para los documentos de tipo '1.3', utiliza la fecha que aparece al final de la primera página, en el bloque de cierre o identificación del informe.

          Busca estructuras similares a:

          'INFORME DE FISCALIZACIÓN INTEGRAL PARI No. 3'
          'FECHA: 16/02/2026'

          En este caso, la fecha correcta es '16/02/2026'.

          Busca etiquetas como 'FECHA:', 'FECHA DE ELABORACIÓN:' o equivalentes, siempre que estén asociadas al encabezado final del informe de fiscalización en la primera página.

          No utilices fechas de páginas posteriores, fechas de visitas, fechas de elaboración de otros documentos citados ni fechas de firma o registro del título minero.

          Si el bloque final de la primera página no está incluido en el texto recibido, no sustituyas la fecha por otra encontrada en el documento. Devuelve 'DESCONOCIDO' para 'fecha'.

          ### C. NORMALIZACIÓN DE LA FECHA

          Convierte la fecha seleccionada a ocho dígitos continuos con el formato 'DDMMAAAA'.

          Ejemplos:
          - '29/01/2026' → '29012026'
          - '5 de mayo de 2024' → '05052024'
          - '16/02/2026' → '16022026'
          - 'Bogotá, D.C., 29 de enero de 2026' → '29012026'

          Si el día, mes o año no se pueden determinar con certeza, devuelve 'DESCONOCIDO'.

          ## 4. ESTADO DEL PROCESAMIENTO

          Devuelve 'PROCESADO' únicamente cuando los tres campos 'contract', 'type' y 'fecha' se hayan identificado con certeza.

          Si uno o más campos no pueden determinarse, devuelve 'PENDIENTE'. En ese caso, asigna 'DESCONOCIDO' exclusivamente a los campos que no se pudieron identificar.

          No cambies a 'PENDIENTE' un documento cuya información sea clara solo porque existan otras fechas irrelevantes en el contenido.

          ## 5. EJEMPLOS DE VALIDACIÓN

          ### Ejemplo 1: Auto de fiscalización

          Entrada:
          'AUTO DE FISCALIZACIÓN INTEGRAL'
          'Bogotá 29/01/2026'
          'REFERENCIA CONTRATO DE CONCESIÓN No. 4448A (LEY 685 DE 2001)'

          Si el sustento corresponde a un informe de visita, la salida debe ser:

          {"status":"PROCESADO","contract":"4448A","type":"1.4","fecha":"29012026"}

          ### Ejemplo 2: Informe de fiscalización integral

          Entrada:
          'INFORME DE FISCALIZACIÓN INTEGRAL PARI No. 3'
          'FECHA: 16/02/2026'
          'CONTRATO DE CONCESIÓN No. 4448A'

          Si estos datos corresponden al bloque de identificación final de la primera página y el código contractual está confirmado, la fecha de salida debe ser '16022026' y el tipo debe ser '1.3'.

          ## 6. FORMATO DE SALIDA

          Responde únicamente con JSON plano válido, sin Markdown, explicaciones, comentarios ni texto adicional.

          Utiliza exactamente estas claves y valores:

          {
            "status": "PROCESADO",
            "contract": "4448A",
            "type": "1.4",
            "fecha": "29012026"
          }

          El ejemplo anterior ilustra la estructura, no los valores que deban copiarse en documentos diferentes.

          ## TEXTO DEL DOCUMENTO

          ${textFile}`,
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
    .replace(/^"""(?:json)?\s*/i, '')
    .replace(/\s*"""$/, '')
    .trim();

  try {
    const parsedData = JSON.parse(cleanedText) as AnalysisResult;
    return parsedData;
  } catch (error) {
    throw new Error(`Error al parsear el JSON de la IA: ${textContent}`);
  }
}
