import { PDFParse } from "pdf-parse";

export const readPdf = async (filePath: string): Promise<string> => {
  try {
    const pdf = new PDFParse({
      data: await Bun.file(filePath).arrayBuffer(),
    });

    const result = await pdf.getText();

    return result.pages.map((page) => page.text).join("\n");
  } catch (err) {
    console.error(`❌ Error leyendo "${filePath}":`, err);
    throw err;
  }
};