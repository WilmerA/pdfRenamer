import { readdir, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { readPdf } from "../pdf/pdf-reader";
import { getInfo, AnalysisResult } from "../process-ia/extract-info";

interface FolderPaths {
  input: string;
  processed: string;
  review: string;
}

function getSafeDestination(destDir: string, fileName: string): string {
  let destPath = path.join(destDir, fileName);
  let counter = 1;

  while (true) {
    try {
      // Verificar si existe
      require("node:fs").accessSync(destPath);
      // Si existe, generar nuevo nombre con sufijo
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      destPath = path.join(destDir, `${base} (${counter})${ext}`);
      counter++;
    } catch {
      // No existe, podemos usar este nombre
      break;
    }
  }
  return destPath;
}

function getContractFolderName(analysis: AnalysisResult): string {
  if (analysis.contract && analysis.contract !== "DESCONOCIDO") {
    return analysis.contract;
  }
  return "SIN_CONTRATO";
}

export async function startFolder(folders: FolderPaths) {
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
    let moveToReview = false;
    let reviewReason = "";

    try {
      const text = await readPdf(filePath);

      if (!text || text.trim().length === 0) {
        moveToReview = true;
        reviewReason = "PDF sin texto extraíble";
      } else {
        
        analysis = await getInfo(text);

        if (analysis.status !== "PROCESADO") {
          moveToReview = true;
          reviewReason = `Status: ${analysis.status}`;
        } else if (
          analysis.type === "DESCONOCIDO" ||
          analysis.contract === "DESCONOCIDO" ||
          analysis.fecha === "DESCONOCIDO"
        ) {
          moveToReview = true;
          reviewReason = "Datos incompletos (DESCONOCIDO)";
        }
      }
    } catch (error) {
      moveToReview = true;
      reviewReason = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (moveToReview) {
      // Determinar carpeta de contrato para review
      const contractFolder = analysis?.contract && analysis.contract !== "DESCONOCIDO"
        ? analysis.contract
        : "SIN_CONTRATO";

      const reviewContractDir = path.join(folders.review, contractFolder);
      await mkdir(reviewContractDir, { recursive: true });

      const destPath = getSafeDestination(reviewContractDir, fileName);

      try {
        await rename(filePath, destPath);
        console.log(`📁 Movido a review: ${path.relative(folders.review, destPath)}`);
        if (reviewReason) console.log(`   Motivo: ${reviewReason}`);
        reviewCount++;
      } catch (moveError) {
        console.error(`❌ Error moviendo a review:`, moveError);
        errorCount++;
      }
    } else if (analysis) {
      // PROCESADO - renombrar y mover a processed
      const newFileName = `${analysis.type}_${analysis.contract}_${analysis.fecha}.pdf`;
      const processedContractDir = path.join(folders.processed, analysis.contract);
      await mkdir(processedContractDir, { recursive: true });

      const destPath = getSafeDestination(processedContractDir, newFileName);

      try {
        await rename(filePath, destPath);
        console.log(`✅ Procesado: ${path.relative(folders.processed, destPath)}`);
        processedCount++;
      } catch (moveError) {
        console.error(`❌ Error moviendo a processed:`, moveError);
        errorCount++;
      }
    }

    console.log("");
  }

  console.log("===== RESUMEN =====");
  console.log(`Total PDFs:       ${pdfFiles.length}`);
  console.log(`✅ Procesados:    ${processedCount}`);
  console.log(`📋 En revisión:   ${reviewCount}`);
  console.log(`❌ Errores:       ${errorCount}`);
}