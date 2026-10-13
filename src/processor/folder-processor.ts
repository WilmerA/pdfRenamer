import { readdir } from "node:fs/promises";
import path from "node:path";
import { extractContractNumber } from "../parsers/contract-number-parser";
import { readPdf } from "../pdf/pdf-reader";
import { getInfo } from "../process-ia/extract-info";

export async function startFolder(folder: string) {
  console.log(`📂 Procesando carpeta: ${folder}`);

  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    console.error(`❌ No se pudo leer la carpeta ${folder}:`, error);
    return;
  }

  const pdfFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => path.join(folder, entry.name));

  if (pdfFiles.length === 0) {
    console.log("ℹ️ No se encontraron archivos PDF en la carpeta.");
    return;
  }

  console.log(`📄 Encontrados ${pdfFiles.length} archivo(s) PDF.\n`);


  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    console.log(`--- Procesando: ${fileName} ---`);

    try {
      const text = (await readPdf(filePath)).slice(0, 10000);
      const analysis = await getInfo(text);
      
      if(  analysis.status === 'PROCESADO') {
        console.log(`✅ Resultado del análisis: ${JSON.stringify(analysis)}`);
      } else {
        console.log(`⚠️ Resultado del análisis: ${JSON.stringify(analysis)}`);
      }
    
    } catch (error) {
      console.error(`❌ Error procesando ${fileName}:`, error);
    }
    console.log("");
  }

}