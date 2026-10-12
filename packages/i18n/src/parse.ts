import type { Block, ContentDoc, Marker, PageDoc } from "./types.ts";

const MARKER_RE = /^<!--\s*(auto|draft)\s+src-hash:([0-9a-f]+)\s*-->$/;
const SETTING_RE = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/;

export class ContentParseError extends Error {
  constructor(message: string, line: number) {
    super(`line ${line}: ${message}`);
    this.name = "ContentParseError";
  }
}

/**
 * Parses one content file (content/<lang>.md).
 * `# page` → `## lang` or `## settings` → `### key` → body.
 * A `<!-- auto|draft src-hash:… -->` line right before `### key` marks the block as machine translated.
 */
export function parseContent(raw: string): ContentDoc {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const doc: ContentDoc = { preamble: "", pages: {} };
  const preamble: string[] = [];

  let page: PageDoc | undefined;
  let section: string | undefined;
  let key: string | undefined;
  let body: string[] = [];
  let pendingMarker: { marker: Marker; line: number } | undefined;
  let blockMarker: Marker | undefined;

  const flush = () => {
    if (page && section && key) {
      const block: Block = { text: trimBlankLines(body).join("\n") };
      if (blockMarker) block.marker = blockMarker;
      page.langs[section]![key] = block;
    }
    key = undefined;
    body = [];
    blockMarker = undefined;
  };

  lines.forEach((line, i) => {
    const n = i + 1;
    const h = /^(#{1,3}) +(.+?)\s*$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const name = h[2]!;
      flush();
      if (pendingMarker && level < 3) {
        throw new ContentParseError("marker must be followed by a ### key", pendingMarker.line);
      }
      if (level === 1) {
        if (doc.pages[name]) throw new ContentParseError(`duplicate page "${name}"`, n);
        page = { settings: {}, langs: {} };
        doc.pages[name] = page;
        section = undefined;
      } else if (level === 2) {
        if (!page) throw new ContentParseError(`section "${name}" outside a page`, n);
        if (name !== "settings") {
          if (page.langs[name]) throw new ContentParseError(`duplicate section "${name}"`, n);
          page.langs[name] = {};
        }
        section = name;
      } else {
        if (!page || !section) throw new ContentParseError(`key "${name}" outside a language section`, n);
        if (section === "settings")
          throw new ContentParseError("settings use `key: value` lines, not ### keys", n);
        if (page.langs[section]![name])
          throw new ContentParseError(`duplicate key "${name}" in ${section}`, n);
        key = name;
        blockMarker = pendingMarker?.marker;
        pendingMarker = undefined;
      }
      return;
    }

    if (!page) {
      preamble.push(line);
      return;
    }

    const m = MARKER_RE.exec(line.trim());
    if (m && !key && section && section !== "settings") {
      pendingMarker = { marker: { mode: m[1] as Marker["mode"], hash: m[2]! }, line: n };
      return;
    }
    if (m && key) {
      // Marker after a body belongs to the next key.
      flush();
      pendingMarker = { marker: { mode: m[1] as Marker["mode"], hash: m[2]! }, line: n };
      return;
    }

    if (section === "settings") {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("<!--")) return;
      const s = SETTING_RE.exec(trimmed);
      if (!s) throw new ContentParseError(`invalid setting line "${trimmed}"`, n);
      page.settings[s[1]!] = s[2]!.trim();
      return;
    }

    if (key) {
      body.push(line);
      return;
    }

    if (line.trim() && !line.trim().startsWith("<!--")) {
      throw new ContentParseError("text outside a ### key", n);
    }
  });

  flush();
  if (pendingMarker) throw new ContentParseError("marker must be followed by a ### key", pendingMarker.line);
  doc.preamble = trimBlankLines(preamble).join("\n");
  return doc;
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start]!.trim()) start++;
  while (end > start && !lines[end - 1]!.trim()) end--;
  return lines.slice(start, end);
}
