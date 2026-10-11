import { srcHash } from "../../packages/i18n/src/hash.ts";
import type { ContentDoc } from "../../packages/i18n/src/types.ts";
import { fallback, type Language, pageLanguages } from "../../site.config.ts";

export interface Job {
  page: string;
  lang: string;
  mode: "auto" | "draft";
  /** key → English source */
  items: Record<string, string>;
}

export interface Plan {
  jobs: Job[];
  /** gsw style drafts still carrying a draft marker (not yet reviewed). */
  draftsRemaining: string[];
  /** Locked blocks whose English source changed since they were locked. */
  staleLocked: string[];
  /** Hashes to remember for locked blocks (page/lang/key → hash). */
  lockedHashes: Record<string, string>;
}

/**
 * Decides what to translate:
 *  missing block            → translate (auto or draft marker)
 *  auto marker, hash differs → retranslate
 *  draft marker              → never touched, counted as remaining draft
 *  no marker (locked)        → never touched, warned when its English source changed
 */
export function planTranslations(
  doc: ContentDoc,
  languages: readonly Language[],
  previousLocked: Record<string, string>,
): Plan {
  const plan: Plan = { jobs: [], draftsRemaining: [], staleLocked: [], lockedHashes: {} };
  for (const [page, p] of Object.entries(doc.pages)) {
    const source = p.langs[fallback];
    if (!source) continue;
    const allowed: readonly string[] = pageLanguages(page);
    for (const lang of languages) {
      if (lang.translate === "source" || !allowed.includes(lang.code)) continue;
      const blocks = p.langs[lang.code] ?? {};
      const items: Record<string, string> = {};
      for (const [key, src] of Object.entries(source)) {
        const hash = srcHash(src.text);
        const id = `${page}/${lang.code}/${key}`;
        const existing = blocks[key];
        if (!existing) items[key] = src.text;
        else if (existing.marker?.mode === "auto") {
          if (existing.marker.hash !== hash) items[key] = src.text;
        } else if (existing.marker?.mode === "draft") plan.draftsRemaining.push(id);
        else {
          const known = previousLocked[id];
          plan.lockedHashes[id] = known ?? hash;
          if (known && known !== hash) plan.staleLocked.push(id);
        }
      }
      if (Object.keys(items).length) {
        plan.jobs.push({ page, lang: lang.code, mode: lang.translate === "draft" ? "draft" : "auto", items });
      }
    }
  }
  return plan;
}

/** Writes translated texts into the doc with markers. */
export function applyJob(doc: ContentDoc, job: Job, translated: Record<string, string>): number {
  const page = doc.pages[job.page]!;
  page.langs[job.lang] ??= {};
  let n = 0;
  for (const [key, src] of Object.entries(job.items)) {
    const text = translated[key];
    if (!text) continue;
    page.langs[job.lang]![key] = { text: text.trim(), marker: { mode: job.mode, hash: srcHash(src) } };
    n++;
  }
  return n;
}

/** Placeholders and Markdown link targets must survive translation unchanged. */
export function preservesTokens(source: string, translated: string): boolean {
  const tokens = (s: string) => [...s.matchAll(/\{[A-Za-z0-9_]+\}|\]\([^)]+\)/g)].map((m) => m[0]).sort();
  return JSON.stringify(tokens(source)) === JSON.stringify(tokens(translated));
}
