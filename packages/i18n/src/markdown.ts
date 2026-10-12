const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!);
}

function safeHref(url: string): string | undefined {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u) || u.startsWith("/") || u.startsWith("#")) return u;
  return undefined;
}

/** Inline Markdown: **bold**, *italic* / _italic_, [link](url). Input is escaped first. */
export function renderInline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
    const href = safeHref(url.replace(/&amp;/g, "&"));
    if (!href) return label;
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener"' : ""}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1<em>$2</em>");
  return s;
}

/**
 * Block Markdown: paragraphs (blank line), line breaks (single newline), `- ` lists.
 * (`#` headings are content.md structure, so bodies use **bold** lines as sub headings.)
 * Single paragraph text renders without a <p> wrapper when `inline` is true.
 */
export function renderMarkdown(text: string, opts: { inline?: boolean } = {}): string {
  const blocks = text.trim().split(/\n\s*\n/);
  if (opts.inline && blocks.length === 1 && !/^- /m.test(text)) {
    return blocks[0]!.split("\n").map(renderInline).join("<br>");
  }
  return blocks
    .map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => l.startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${renderInline(l.slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(renderInline).join("<br>")}</p>`;
    })
    .join("");
}

/** Removes Markdown syntax for plain text contexts (emails, PDFs, meta tags). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1$2");
}
