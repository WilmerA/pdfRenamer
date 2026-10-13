import path from "node:path";
import { mkdir } from "node:fs/promises";

import { startFolder } from "./processor/folder-processor";

const FOLDERS = {
  input: path.resolve("folders/input"),
  processed: path.resolve("folders/processed"),
  review: path.resolve("folders/review"),
};

await mkdir(FOLDERS.input, { recursive: true });
await mkdir(FOLDERS.processed, { recursive: true });
await mkdir(FOLDERS.review, { recursive: true });

console.log("🚀 PDF Renamer iniciado (modo batch)");

await startFolder(FOLDERS.input);