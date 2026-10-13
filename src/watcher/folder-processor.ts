import { readdir } from "node:fs/promises";
import path from "node:path";
import { extractContractNumber } from "../parsers/contract-number-parser";
import { readPdf } from "../pdf/pdf-reader";

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

  let processed = 0;
  let withContract = 0;
  let withoutContract = 0;
  let withError = 0;

  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    console.log(`--- Procesando: ${fileName} ---`);

    try {
      const text = await readPdf(filePath);
      console.log('text', text)
      const contractNumber = extractContractNumber(text);

      if (contractNumber) {
        console.log(`⛏️ Número de contrato: ${contractNumber}`);
        withContract++;
      } else {
        console.log("⚠️ No se encontró número de contrato");
        withoutContract++;
      }
      processed++;
    } catch (error) {
      console.error(`❌ Error procesando ${fileName}:`, error);
      withError++;
    }
    console.log("");
  }

  console.log("===== RESUMEN =====");
  console.log(`Total PDFs:     ${pdfFiles.length}`);
  console.log(`Procesados OK:  ${processed}`);
  console.log(`Con contrato:   ${withContract}`);
  console.log(`Sin contrato:   ${withoutContract}`);
  console.log(`Con error:      ${withError}`);
}