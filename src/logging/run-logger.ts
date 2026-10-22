import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { format } from "node:util";

type LogMethod = "log" | "info" | "warn" | "error";
type ConsoleMethod = (...args: unknown[]) => void;

const LOG_METHODS: LogMethod[] = ["log", "info", "warn", "error"];

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function getTimestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getLogFileName(date: Date): string {
  return `run-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-` +
    `${pad(date.getMilliseconds(), 3)}.log`;
}

export interface RunLogger {
  filePath: string;
  close(): Promise<void>;
}

export async function startRunLogger(logDirectory: string): Promise<RunLogger> {
  await mkdir(logDirectory, { recursive: true });

  const startedAt = new Date();
  const filePath = path.join(logDirectory, getLogFileName(startedAt));
  const file = await open(filePath, "a");
  const target = console as unknown as Record<LogMethod, ConsoleMethod>;
  const originalMethods = new Map<LogMethod, ConsoleMethod>();
  const apiKey = process.env.API_OPEN_ROUTER?.trim();
  let writeQueue = Promise.resolve();
  let writeError: unknown;

  const enqueue = (line: string) => {
    writeQueue = writeQueue
      .then(async () => {
        if (!writeError) await file.appendFile(line, "utf8");
      })
      .catch((error: unknown) => {
        writeError = error;
      });
  };

  for (const method of LOG_METHODS) {
    const original = target[method].bind(console);
    originalMethods.set(method, original);

    target[method] = (...args: unknown[]) => {
      original(...args);

      let message = format(...args);
      if (apiKey) message = message.replaceAll(apiKey, "[API_KEY_REDACTED]");
      enqueue(`${getTimestamp()} [${method.toUpperCase()}] ${message}\n`);
    };
  }

  enqueue(`${getTimestamp(startedAt)} [INFO] Inicio de ejecución.\n`);

  return {
    filePath,
    async close() {
      enqueue(`${getTimestamp()} [INFO] Fin de ejecución.\n`);
      await writeQueue;

      for (const method of LOG_METHODS) {
        const original = originalMethods.get(method);
        if (original) target[method] = original;
      }

      await file.close();

      if (writeError) {
        const originalError = originalMethods.get("error");
        originalError?.("No se pudo completar el archivo de log:", writeError);
      }
    },
  };
}
