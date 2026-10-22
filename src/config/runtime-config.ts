import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RuntimeConfig {
  apiKey: string | undefined;
  applicationDirectory: string;
  configFile: string;
  workspace: string;
}

function getApplicationDirectory(): string {
  const runningWithBunCli = /(?:^|[\\/])bun(?:\.exe)?$/i.test(process.execPath);
  if (!runningWithBunCli) {
    return path.dirname(process.execPath);
  }

  // En desarrollo, usa la raíz del proyecto (src/config/runtime-config.ts).
  return path.resolve(import.meta.dir, "../..");
}

function readApiKey(contents: string): string | undefined {
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*API_OPEN_ROUTER\s*=\s*(.*?)\s*$/);
    if (!match) continue;

    let value = match[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (value && !value.startsWith("#")) return value;
  }

  return undefined;
}

export async function loadRuntimeConfig(
  workspaceOverride?: string,
): Promise<RuntimeConfig> {
  const applicationDirectory = getApplicationDirectory();
  const configFile = path.join(applicationDirectory, "config.env");
  await mkdir(applicationDirectory, { recursive: true });

  let fileContents = "";
  try {
    fileContents = await readFile(configFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    fileContents =
      "# Agrega tu clave personal de OpenRouter en la siguiente línea.\n" +
      "API_OPEN_ROUTER=\n";
    await writeFile(configFile, fileContents, { encoding: "utf8", flag: "wx" }).catch(
      (writeError) => {
        if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") {
          throw writeError;
        }
      },
    );
  }

  // La variable del entorno de Windows tiene prioridad sobre el archivo.
  const apiKey = process.env.API_OPEN_ROUTER?.trim() || readApiKey(fileContents);
  if (apiKey) process.env.API_OPEN_ROUTER = apiKey;

  const defaultWorkspace = path.join(applicationDirectory, "workspace");
  const workspace = path.resolve(workspaceOverride || defaultWorkspace);

  return { apiKey, applicationDirectory, configFile, workspace };
}

export function printHelp(executableName = "PdfRenamer.exe"): void {
  console.log(`${executableName} - clasifica y renombra PDFs de documentos ANM

Uso:
  ${executableName} [--workspace <ruta>]
  ${executableName} --help

Opciones:
  --workspace, -w <ruta>  Carpeta de trabajo que contiene input, processed y review.
                          Predeterminada: carpeta workspace junto al ejecutable.
  --help, -h              Muestra esta ayuda.

Los PDFs de input se procesan y se mueven a processed o review.`);
}

export function parseWorkspaceArgument(args: string[]): {
  help: boolean;
  workspace?: string;
} {
  let workspace: string | undefined;
  let help = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }

    if (argument === "--workspace" || argument === "-w") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Falta la ruta después de ${argument}.`);
      }
      workspace = value;
      index++;
      continue;
    }

    throw new Error(`Opción no reconocida: ${argument}`);
  }

  return { help, workspace };
}
