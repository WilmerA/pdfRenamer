import { mkdir } from "node:fs/promises";
import path from "node:path";
import { startFolder } from "./processor/folder-processor";
import {
  loadRuntimeConfig,
  parseWorkspaceArgument,
  printHelp,
} from "./config/runtime-config";
import { startRunLogger, type RunLogger } from "./logging/run-logger";

let runLogger: RunLogger | undefined;

try {
  const options = parseWorkspaceArgument(Bun.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exitCode = 0;
  } else {
    const config = await loadRuntimeConfig(options.workspace);
    runLogger = await startRunLogger(path.join(config.applicationDirectory, "logs"));
    console.log(`📝 Log de esta ejecución: ${runLogger.filePath}`);

    if (!config.apiKey) {
      console.error("❌ No se configuró la API key de OpenRouter.");
      console.error(`   Abre este archivo y agrega API_OPEN_ROUTER=tu_clave:\n   ${config.configFile}`);
      console.error("   También puedes definir API_OPEN_ROUTER en las variables de entorno de Windows.");
      process.exitCode = 1;
    } else {
      const folders = {
        input: path.join(config.workspace, "input"),
        processed: path.join(config.workspace, "processed"),
        review: path.join(config.workspace, "review"),
      };

      await Promise.all([
        mkdir(folders.input, { recursive: true }),
        mkdir(folders.processed, { recursive: true }),
        mkdir(folders.review, { recursive: true }),
      ]);

      console.log("🚀 PDF Renamer iniciado (Windows, modo batch)");
      console.log(`📂 Workspace:        ${config.workspace}`);
      console.log(`📥 Carpeta de entrada: ${folders.input}`);
      console.log(`✅ Procesados:        ${folders.processed}`);
      console.log(`📋 Revisión:          ${folders.review}\n`);

      await startFolder(folders);
    }
  }
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  console.error("Usa --help para ver las opciones disponibles.");
  process.exitCode = 1;
} finally {
  await runLogger?.close();
}
