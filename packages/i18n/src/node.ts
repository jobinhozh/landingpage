/** Node-only helpers (scripts, Astro config). Workers import the bundled files via content.ts. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fallback, languages } from "../../../site.config.ts";
import { parseContentFiles, serializeContentFiles } from "./files.ts";
import type { ContentDoc } from "./types.ts";

export const CONTENT_DIR = new URL("../../../content/", import.meta.url);

export function readContentFiles(dir: URL = CONTENT_DIR): Record<string, string> {
  const codes: string[] = languages.map((l) => l.code);
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const code = name.slice(0, -3);
    if (!codes.includes(code))
      throw new Error(`content/${name}: "${code}" is not a language in site.config.ts`);
    files[code] = readFileSync(new URL(name, dir), "utf8");
  }
  return files;
}

export function readContentDir(dir: URL = CONTENT_DIR): ContentDoc {
  return parseContentFiles(readContentFiles(dir), fallback);
}

/** Writes changed files only. Returns the languages that changed. */
export function writeContentDir(doc: ContentDoc, dir: URL = CONTENT_DIR): string[] {
  const changed: string[] = [];
  for (const [lang, text] of Object.entries(
    serializeContentFiles(
      doc,
      languages.map((l) => l.code),
      fallback,
    ),
  )) {
    const file = new URL(`${lang}.md`, dir);
    if (existsSync(file) && readFileSync(file, "utf8") === text) continue;
    writeFileSync(file, text);
    changed.push(lang);
  }
  return changed;
}
