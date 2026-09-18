// Resolves the "@/…" alias and extension-less relative imports for `node --test`
// (Node strips TypeScript types natively; it does not read tsconfig paths).
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(fileURLToPath(new URL("../src/", import.meta.url)));
const EXTENSIONS = [".ts", ".tsx", ".cjs", ".mjs", ".js"];

const withExtension = (file) => {
  if (existsSync(file) && statSync(file).isFile()) return file;
  for (const ext of EXTENSIONS) if (existsSync(file + ext)) return file + ext;
  for (const ext of EXTENSIONS) if (existsSync(path.join(file, "index" + ext))) return path.join(file, "index" + ext);
  return undefined;
};

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const target = withExtension(path.join(SRC, specifier.slice(2)));
    if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    const target = withExtension(path.resolve(base, specifier));
    if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  return next(specifier, context);
}
