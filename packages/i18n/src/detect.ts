import { fallback, languages, regionalOverrides } from "../../../site.config.ts";

const configOrder: readonly string[] = languages.map((l) => l.code);

interface Candidate {
  code: string;
  q: number;
}

function toCode(tag: string, available: readonly string[]): string | undefined {
  const t = tag.toLowerCase();
  const override = regionalOverrides[t];
  if (override && available.includes(override)) return override;
  if (available.includes(t)) return t;
  const primary = t.split("-")[0]!;
  if (available.includes(primary)) return primary;
  return undefined;
}

/**
 * Picks a language from an Accept-Language header.
 * Higher q wins, ties are broken by the order in site.config.ts. Unsupported → fallback.
 */
export function detectLanguage(
  header: string | null | undefined,
  available: readonly string[] = configOrder,
): string {
  const def = available.includes(fallback) ? fallback : available[0]!;
  if (!header) return def;

  const candidates: Candidate[] = [];
  for (const part of header.split(",")) {
    const [rawTag, ...params] = part.trim().split(";");
    const tag = rawTag?.trim();
    if (!tag || tag === "*") continue;
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split("=");
      if (k === "q") q = Number.parseFloat(v ?? "");
    }
    if (!Number.isFinite(q) || q <= 0) continue;
    const code = toCode(tag, available);
    if (code) candidates.push({ code, q });
  }
  if (!candidates.length) return def;

  candidates.sort((a, b) => b.q - a.q || configOrder.indexOf(a.code) - configOrder.indexOf(b.code));
  return candidates[0]!.code;
}

export function languageBySlug(slug: string) {
  return languages.find((l) => l.slug === slug);
}

export function languageByCode(code: string) {
  return languages.find((l) => l.code === code);
}
