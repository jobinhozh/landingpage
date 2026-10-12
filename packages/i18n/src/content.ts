/**
 * The parsed content.md, bundled at build time (Vite `?raw`), so it also works inside a Worker.
 * Config or content errors fail the build, missing translations print warnings.
 */
import raw from "../../../content/content.md?raw";
import { parseContent } from "./parse.ts";
import { createTranslator } from "./translator.ts";
import { validateConfig, validateContent } from "./validate.ts";

const configErrors = validateConfig();
export const doc = parseContent(raw);
const result = validateContent(doc);
const errors = [...configErrors, ...result.errors];
if (errors.length) throw new Error(`Content validation failed:\n${errors.join("\n")}`);

export const { t, tm, ti, setting, has } = createTranslator(doc);
export const contentWarnings = result.warnings;
