/**
 * The parsed content/<lang>.md files, bundled at build time (Vite glob, `?raw`), so it also works inside a Worker.
 * Config or content errors fail the build, missing translations print warnings.
 */
import { fallback } from "../../../site.config.ts";
import { parseContentFiles } from "./files.ts";
import { createTranslator } from "./translator.ts";
import { validateConfig, validateContent } from "./validate.ts";

const raw = import.meta.glob<string>("../../../content/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const files = Object.fromEntries(
  Object.entries(raw).map(([path, text]) => [path.split("/").pop()!.slice(0, -3), text]),
);

const configErrors = validateConfig();
export const doc = parseContentFiles(files, fallback);
const result = validateContent(doc);
const errors = [...configErrors, ...result.errors];
if (errors.length) throw new Error(`Content validation failed:\n${errors.join("\n")}`);

export const { t, tm, ti, setting, has } = createTranslator(doc);
export const contentWarnings = result.warnings;
