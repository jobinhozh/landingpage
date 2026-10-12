import type { Block, ContentDoc } from "./types.ts";

/**
 * Writes a ContentDoc back to content Markdown in canonical order:
 * pages as given, `settings` first, then the source language, then the configured language order.
 * Keys follow the source language order, extra keys keep their own order after that.
 */
export function serializeContent(doc: ContentDoc, langOrder: readonly string[], source: string): string {
  const out: string[] = [];
  if (doc.preamble) out.push(doc.preamble, "");

  for (const [pageName, page] of Object.entries(doc.pages)) {
    out.push(`# ${pageName}`, "");
    const settings = Object.entries(page.settings);
    if (settings.length) {
      out.push("## settings", "");
      for (const [k, v] of settings) out.push(`${k}: ${v}`);
      out.push("");
    }
    const sourceKeys = Object.keys(page.langs[source] ?? {});
    const order = [source, ...langOrder.filter((l) => l !== source)];
    const extra = Object.keys(page.langs).filter((l) => !order.includes(l));
    for (const lang of [...order, ...extra]) {
      const blocks = page.langs[lang];
      if (!blocks) continue;
      out.push(`## ${lang}`, "");
      const keys = [
        ...sourceKeys.filter((k) => k in blocks),
        ...Object.keys(blocks).filter((k) => !sourceKeys.includes(k)),
      ];
      for (const k of keys) out.push(...blockLines(k, blocks[k]!), "");
    }
  }
  return `${out.join("\n").trimEnd()}\n`;
}

function blockLines(key: string, block: Block): string[] {
  const lines: string[] = [];
  if (block.marker) lines.push(`<!-- ${block.marker.mode} src-hash:${block.marker.hash} -->`);
  lines.push(`### ${key}`, block.text);
  return lines;
}
