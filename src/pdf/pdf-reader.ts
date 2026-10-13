import { PDFParse } from "pdf-parse";

export const readPdf = async (filePath: string): Promise<string> => {
  const pdf = new PDFParse({
    data: await Bun.file(filePath).arrayBuffer(),
  });

  try {
    const result = await pdf.getText();
    return result.pages.map((page) => page.text).join("\n");
  } catch (err) {
    console.error(`❌ Error leyendo "${filePath}":`, err);
    throw err;
  } finally {
    try {
      await pdf.destroy();
    } catch {
      // Ignorar errores de limpieza
    }
  }
};