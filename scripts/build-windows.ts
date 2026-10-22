import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const releaseDirectory = path.resolve("release");
const executablePath = path.join(releaseDirectory, "PdfRenamer.exe");

await mkdir(releaseDirectory, { recursive: true });

const result = Bun.spawnSync(
  [
    process.execPath,
    "build",
    "--compile",
    "--target=bun-windows-x64",
    "--minify",
    "src/index.ts",
    `--outfile=${executablePath}`,
  ],
  { stdout: "inherit", stderr: "inherit" },
);

if (result.exitCode !== 0) {
  process.exitCode = 1;
} else {
  await copyFile(
    path.resolve("README-WINDOWS.txt"),
    path.join(releaseDirectory, "LEEME.txt"),
  );
  console.log(`✅ Ejecutable creado: ${executablePath}`);
  console.log("ℹ️ El archivo de configuración y los PDFs no se incluyen en el ejecutable.");
}
