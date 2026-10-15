import { PdfReader } from "pdfreader";

// Bun expone un `Worker` global, lo que hace que pdf.js (vía pdf2json,
// del que depende pdfreader) intente usar un worker real y exija
// PDFJS.workerSrc. Al ocultarlo, pdf.js usa el "fake worker" en la misma
// hebra, igual que sucede en Node.js. Se ejecuta antes de leer cualquier PDF.
(globalThis as { Worker?: unknown }).Worker = undefined;

interface TextItem {
  x: number;
  y: number;
  text: string;
}

// Tolerancia vertical (en las unidades de pdf2json) para considerar que dos
// items pertenecen a la misma línea de texto.
const LINE_TOLERANCE = 0.3;

/**
 * Reconstruye texto legible a partir de los items sueltos que entrega
 * pdfreader: agrupa por página y por línea (coordenada `y`) y ordena cada
 * línea por coordenada `x`.
 */
function itemsToText(pages: TextItem[][]): string {
  return pages
    .map((items) => {
      // Orden por línea (y, de arriba a abajo) y luego por columna (x).
      const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

      const lines: TextItem[][] = [];

      for (const item of sorted) {
        const currentLine = lines[lines.length - 1];

        if (currentLine && Math.abs(currentLine[0].y - item.y) <= LINE_TOLERANCE) {
          currentLine.push(item);
        } else {
          lines.push([item]);
        }
      }

      return lines
        // pdf2json ya incluye los espacios como items, por eso se concatenan.
        .map((line) => {
          const text = line
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join("")
            .replace(/\s+/g, " ")
            .trim();
          return text;
        })
        .filter((line) => line.length > 0)
        .join("\n");
    })
    .join("\n\n");
}

export const readPdf = async (filePath: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const pages: TextItem[][] = [];
    let currentPage: TextItem[] | null = null;

    new PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) {
        console.error(`❌ Error leyendo "${filePath}":`, err);
        reject(new Error(typeof err === "string" ? err : String(err)));
        return;
      }

      // Fin del archivo.
      if (!item) {
        if (currentPage) pages.push(currentPage);
        resolve(itemsToText(pages));
        return;
      }

      // Nueva página: se inicia una colección de items.
      if (item.page) {
        if (currentPage) pages.push(currentPage);
        currentPage = [];
        return;
      }

      if (item.text) {
        if (!currentPage) currentPage = [];
        currentPage.push({ x: item.x, y: item.y, text: item.text });
      }
    });
  });
};
