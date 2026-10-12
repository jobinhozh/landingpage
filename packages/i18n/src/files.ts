import { ContentParseError, parseContent } from "./parse.ts";
import { serializeContent } from "./serialize.ts";
import type { ContentDoc } from "./types.ts";

/**
 * One file per language: content/<code>.md (en.md is the hand-written source).
 * Each file uses the same format, but holds only its own `## <code>` sections.
 * `## settings` (untranslated values) live in the source file only.
 */
export function parseContentFiles(files: Record<string, string>, source: string): ContentDoc {
  const src = files[source];
  if (src === undefined) throw new ContentParseError(`missing ${source}.md (the source language file)`, 0);
  const doc: ContentDoc = { preamble: "", pages: {} };

  for (const [lang, raw] of Object.entries(files)) {
    let part: ContentDoc;
    try {
      part = parseContent(raw);
    } catch (e) {
      throw new Error(`content/${lang}.md: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (lang === source) doc.preamble = part.preamble;
    for (const [name, page] of Object.entries(part.pages)) {
      if (lang !== source && Object.keys(page.settings).length) {
        throw new Error(
          `content/${lang}.md: page "${name}" has ## settings, settings belong in ${source}.md`,
        );
      }
      for (const section of Object.keys(page.langs)) {
        if (section !== lang)
          throw new Error(`content/${lang}.md: page "${name}" has a "## ${section}" section`);
      }
      doc.pages[name] ??= { settings: {}, langs: {} };
      const target = doc.pages[name]!;
      Object.assign(target.settings, page.settings);
      if (page.langs[lang]) target.langs[lang] = page.langs[lang]!;
    }
  }
  // Page order follows the source file.
  const order = Object.keys(parseContent(src).pages);
  doc.pages = Object.fromEntries(
    [...order, ...Object.keys(doc.pages).filter((p) => !order.includes(p))].map((p) => [p, doc.pages[p]!]),
  );
  return doc;
}

export const TRANSLATION_HEADER = (lang: string, source: string) =>
  `<!--\nTranslations for "${lang}". Written by npm run translate from ${source}.md, the only hand-written file.\nauto: retranslated when the English changes. draft: written once, never overwritten, remove the marker once reviewed.\nA block without marker is locked: edit it here and it is never overwritten.\n-->`;

/** The inverse of parseContentFiles: one canonical file per language that has text. */
export function serializeContentFiles(
  doc: ContentDoc,
  langOrder: readonly string[],
  source: string,
): Record<string, string> {
  const langs = [source, ...langOrder.filter((l) => l !== source)];
  const out: Record<string, string> = {};
  for (const lang of langs) {
    const pages: ContentDoc["pages"] = {};
    for (const [name, page] of Object.entries(doc.pages)) {
      const blocks = page.langs[lang];
      const settings = lang === source ? page.settings : {};
      if (!blocks && !Object.keys(settings).length) continue;
      pages[name] = { settings, langs: blocks ? { [lang]: blocks } : {} };
    }
    if (lang !== source && !Object.keys(pages).length) continue;
    const preamble = lang === source ? doc.preamble : TRANSLATION_HEADER(lang, source);
    out[lang] = serializeContent({ preamble, pages }, [lang], lang);
  }
  return out;
}
