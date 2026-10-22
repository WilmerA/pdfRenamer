import { access, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { readPdf } from "../pdf/pdf-reader";
import { getInfo, type AnalysisResult } from "../process-ia/extract-info";

interface FolderPaths {
  input: string;
  processed: string;
  review: string;
}

const VALID_TYPES = new Set(["1.0", "1.2", "1.3", "1.4"]);
const CONTRACT_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;

function isValidContract(contract: unknown): contract is string {
  return (
    typeof contract === "string" &&
    contract !== "DESCONOCIDO" &&
    CONTRACT_PATTERN.test(contract)
  );
}

function isValidDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{8}$/.test(date)) return false;

  const day = Number(date.slice(0, 2));
  const month = Number(date.slice(2, 4));
  const year = Number(date.slice(4, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isCompleteAnalysis(value: AnalysisResult): boolean {
  return (
    value.status === "PROCESADO" &&
    typeof value.type === "string" &&
    VALID_TYPES.has(value.type) &&
    isValidContract(value.contract) &&
    isValidDate(value.fecha)
  );
}

async function getSafeDestination(destDir: string, fileName: string): Promise<string> {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);

  for (let counter = 0; ; counter++) {
    const candidateName = counter === 0
      ? fileName
      : `${baseName} (${counter})${extension}`;
    const candidatePath = path.join(destDir, candidateName);

    try {
      await access(candidatePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return candidatePath;
      }
      throw error;
    }
  }
}

export async function startFolder(folders: FolderPaths): Promise<void> {
  console.log(`📂 Escaneando carpeta de entrada: ${folders.input}\n`);

  let entries;
  try {
    entries = await readdir(folders.input, { withFileTypes: true });
  } catch (error) {
    console.error(`❌ No se pudo leer la carpeta ${folders.input}:`, error);
    return;
  }

  const pdfFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => path.join(folders.input, entry.name));

  if (pdfFiles.length === 0) {
    console.log("ℹ️ No se encontraron archivos PDF en la carpeta.");
    return;
  }

  console.log(`📄 Encontrados ${pdfFiles.length} archivo(s) PDF.\n`);

  let processedCount = 0;
  let reviewCount = 0;
  let errorCount = 0;

  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    console.log(`--- Procesando: ${fileName} ---`);

    let analysis: AnalysisResult | null = null;
    let reviewReason = "";

    try {
      const text = await readPdf(filePath);

      if (!text.trim()) {
        reviewReason = "PDF sin texto extraíble";
      } else {
        analysis = await getInfo(text);
        if (!isCompleteAnalysis(analysis)) {
          reviewReason = analysis.status === "PENDIENTE"
            ? "La IA indicó que la información está pendiente o incompleta"
            : "La respuesta de la IA contiene datos inválidos o incompletos";
        }
      }
    } catch (error) {
      reviewReason = `Error de lectura o análisis: ${error instanceof Error ? error.message : String(error)}`;
    }

    const isProcessed = analysis !== null && isCompleteAnalysis(analysis);
    const contractFolder = analysis && isValidContract(analysis.contract)
      ? analysis.contract
      : "SIN_CONTRATO";
    const destinationDirectory = isProcessed
      ? path.join(folders.processed, contractFolder)
      : path.join(folders.review, contractFolder);
    const destinationFileName = isProcessed && analysis
      ? `${analysis.type}_${analysis.contract}_${analysis.fecha}.pdf`
      : fileName;

    try {
      await mkdir(destinationDirectory, { recursive: true });
      const destinationPath = await getSafeDestination(
        destinationDirectory,
        destinationFileName,
      );
      await rename(filePath, destinationPath);

      if (isProcessed) {
        console.log(`✅ Procesado: ${path.relative(folders.processed, destinationPath)}`);
        processedCount++;
      } else {
        console.log(`📋 Movido a revisión: ${path.relative(folders.review, destinationPath)}`);
        console.log(`   Motivo: ${reviewReason || "Datos no procesables"}`);
        reviewCount++;
      }
    } catch (error) {
      console.error(`❌ No se pudo mover ${fileName}; se deja en input:`, error);
      errorCount++;
    }

    console.log("");
  }

  console.log("===== RESUMEN =====");
  console.log(`Total PDFs:       ${pdfFiles.length}`);
  console.log(`✅ Procesados:    ${processedCount}`);
  console.log(`📋 En revisión:   ${reviewCount}`);
  console.log(`❌ Errores move:  ${errorCount}`);
}
