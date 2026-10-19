import {
  businessLanguages,
  contentPages,
  fallback,
  languages,
  pageLanguages,
  privateLanguages,
} from "../../../site.config.ts";
import { privateThemes, themes } from "../../../themes.ts";
import type { ContentDoc } from "./types.ts";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** Config rules: every language has a theme, fallback and businessLanguages are known codes, no duplicates. */
export function validateConfig(): string[] {
  const errors: string[] = [];
  const codes = languages.map((l) => l.code as string);
  for (const field of ["code", "slug", "chip"] as const) {
    const values = languages.map((l) => l[field] as string);
    const dup = values.filter((v, i) => values.indexOf(v) !== i);
    if (dup.length) errors.push(`site.config: duplicate language ${field} ${dup.join(", ")}`);
  }
  for (const l of languages) {
    if (!themes[l.theme]) errors.push(`site.config: language "${l.code}" uses unknown theme "${l.theme}"`);
  }
  if (!codes.includes(fallback)) errors.push(`site.config: fallback "${fallback}" is not in languages`);
  for (const b of privateLanguages) {
    if (!codes.includes(b)) errors.push(`site.config: privateLanguages contains unknown code "${b}"`);
  }
  for (const code of privateLanguages) {
    const theme = languages.find((l) => l.code === code)?.theme;
    if (theme && !privateThemes[theme])
      errors.push(`themes: private page language "${code}" needs a privateThemes entry for "${theme}"`);
  }
  if (!privateLanguages.includes(fallback))
    errors.push(`site.config: privateLanguages must contain the fallback "${fallback}"`);
  for (const b of businessLanguages) {
    if (!codes.includes(b)) errors.push(`site.config: businessLanguages contains unknown code "${b}"`);
  }
  if (!languages.some((l) => l.translate === "source"))
    errors.push("site.config: no language has translate: source");
  return errors;
}

/**
 * Content rules: known pages and language codes, every key exists in the fallback language.
 * Keys missing in other languages are warnings (they fall back at runtime).
 */
export function validateContent(doc: ContentDoc): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const codes = languages.map((l) => l.code as string);

  for (const [pageName, page] of Object.entries(doc.pages)) {
    if (!(pageName in contentPages)) errors.push(`content: unknown page "${pageName}"`);
    const allowed: readonly string[] = pageName in contentPages ? pageLanguages(pageName) : codes;
    for (const lang of Object.keys(page.langs)) {
      if (!codes.includes(lang)) errors.push(`content: unknown language section "${pageName}/${lang}"`);
      else if (!allowed.includes(lang)) errors.push(`content: "${pageName}" is not published in "${lang}"`);
    }
    const base = page.langs[fallback];
    if (!base) {
      if (Object.keys(page.langs).length)
        errors.push(`content: page "${pageName}" has no ${fallback} section`);
      continue;
    }
    for (const lang of pageLanguages(pageName)) {
      if (lang === fallback) continue;
      const blocks = page.langs[lang] ?? {};
      for (const key of Object.keys(base)) {
        if (!(key in blocks)) warnings.push(`missing ${pageName}/${lang}/${key} (falls back to ${fallback})`);
      }
      for (const key of Object.keys(blocks)) {
        if (!(key in base)) warnings.push(`orphan key ${pageName}/${lang}/${key} (not in ${fallback})`);
      }
    }
  }
  for (const page of Object.keys(contentPages)) {
    if (!doc.pages[page]) errors.push(`content: page "${page}" is missing`);
  }
  return { errors, warnings };
}
