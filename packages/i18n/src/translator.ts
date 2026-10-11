import { fallback } from "../../../site.config.ts";
import { renderMarkdown } from "./markdown.ts";
import type { ContentDoc, Vars } from "./types.ts";

export class MissingKeyError extends Error {}

/** Replaces `{name}` placeholders. Unknown placeholders stay as they are. */
export function interpolate(text: string, vars: Vars): string {
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export interface Translator {
  /** Raw text with placeholders filled. Lookup: page → common → fallback language page → fallback common. */
  t(page: string, key: string, lang: string, vars?: Vars): string;
  /** Same as t, rendered as HTML from Markdown. */
  tm(page: string, key: string, lang: string, vars?: Vars): string;
  /** Inline HTML (no <p> for single paragraphs). */
  ti(page: string, key: string, lang: string, vars?: Vars): string;
  /** Untranslated value from `## settings` of the page, then common. */
  setting(page: string, key: string): string;
  has(page: string, key: string, lang: string): boolean;
}

export function createTranslator(doc: ContentDoc): Translator {
  const lookup = (page: string, key: string, lang: string): string | undefined => {
    const order: [string, string][] = [
      [page, lang],
      ["common", lang],
      [page, fallback],
      ["common", fallback],
    ];
    for (const [p, l] of order) {
      const b = doc.pages[p]?.langs[l]?.[key];
      if (b) return b.text;
    }
    return undefined;
  };

  const settingVars = (page: string): Vars => ({
    ...(doc.pages.common?.settings ?? {}),
    ...(doc.pages[page]?.settings ?? {}),
  });

  const t = (page: string, key: string, lang: string, vars: Vars = {}) => {
    const text = lookup(page, key, lang);
    if (text === undefined)
      throw new MissingKeyError(`content.md: missing key ${page}/${key} (no ${fallback} fallback)`);
    return interpolate(text, { ...settingVars(page), ...vars });
  };

  return {
    t,
    tm: (page, key, lang, vars) => renderMarkdown(t(page, key, lang, vars)),
    ti: (page, key, lang, vars) => renderMarkdown(t(page, key, lang, vars), { inline: true }),
    setting(page, key) {
      const v = doc.pages[page]?.settings[key] ?? doc.pages.common?.settings[key];
      if (v === undefined) throw new MissingKeyError(`content.md: missing setting ${page}/${key}`);
      return v;
    },
    has: (page, key, lang) => doc.pages[page]?.langs[lang]?.[key] !== undefined,
  };
}
