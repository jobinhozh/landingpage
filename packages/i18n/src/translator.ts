import { fallback, lookupChain } from "../../../site.config.ts";
import { renderMarkdown } from "./markdown.ts";
import type { ContentDoc, Vars } from "./types.ts";

export class MissingKeyError extends Error {}

/** Replaces `{name}` placeholders. Unknown placeholders stay as they are. */
export function interpolate(text: string, vars: Vars): string {
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export interface Translator {
  /**
   * Raw text with placeholders filled. Lookup in the requested language first, then the fallback language,
   * each time through the page, its parent (e.g. kid-one → kids) and common.
   */
  t(page: string, key: string, lang: string, vars?: Vars): string;
  /** Same as t, rendered as HTML from Markdown. */
  tm(page: string, key: string, lang: string, vars?: Vars): string;
  /** Inline HTML (no <p> for single paragraphs). */
  ti(page: string, key: string, lang: string, vars?: Vars): string;
  /** Untranslated value from `## settings` of the page, its parent, then common. */
  setting(page: string, key: string): string;
  has(page: string, key: string, lang: string): boolean;
}

export function createTranslator(doc: ContentDoc): Translator {
  const lookup = (page: string, key: string, lang: string): string | undefined => {
    const chain = lookupChain(page);
    for (const l of lang === fallback ? [lang] : [lang, fallback]) {
      for (const p of chain) {
        const b = doc.pages[p]?.langs[l]?.[key];
        if (b) return b.text;
      }
    }
    return undefined;
  };

  /** Settings of the whole chain, the most specific page wins. */
  const settingVars = (page: string): Vars =>
    Object.assign(
      {},
      ...lookupChain(page)
        .reverse()
        .map((p) => doc.pages[p]?.settings ?? {}),
    );

  const t = (page: string, key: string, lang: string, vars: Vars = {}) => {
    const text = lookup(page, key, lang);
    if (text === undefined)
      throw new MissingKeyError(`content: missing key ${page}/${key} (no ${fallback} fallback)`);
    return interpolate(text, { ...settingVars(page), ...vars });
  };

  return {
    t,
    tm: (page, key, lang, vars) => renderMarkdown(t(page, key, lang, vars)),
    ti: (page, key, lang, vars) => renderMarkdown(t(page, key, lang, vars), { inline: true }),
    setting(page, key) {
      const v = settingVars(page)[key];
      if (v === undefined) throw new MissingKeyError(`content: missing setting ${page}/${key}`);
      return String(v);
    },
    has: (page, key, lang) => doc.pages[page]?.langs[lang]?.[key] !== undefined,
  };
}
