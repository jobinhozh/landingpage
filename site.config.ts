/**
 * Single source of truth for languages, pages and tone.
 * Routes, switcher, themes, sitemap and card PDFs are generated from here.
 * Nothing else may hardcode a language list.
 */

export type TranslateMode = "source" | "auto" | "draft";

export interface Language {
  /** Internal code: content.md sections, <html lang>, translation. */
  code: string;
  /** Text shown in the language switcher. */
  chip: string;
  /** URL path segment. */
  slug: string;
  label: string;
  flag: string;
  /** Key into themes.ts. */
  theme: string;
  translate: TranslateMode;
}

export const languages = [
  {
    code: "gsw",
    chip: "CH",
    slug: "ch",
    label: "Schwiizerdütsch",
    flag: "🇨🇭",
    theme: "switzerland",
    translate: "draft",
  },
  { code: "de", chip: "DE", slug: "de", label: "Deutsch", flag: "🇩🇪", theme: "germany", translate: "auto" },
  { code: "fr", chip: "FR", slug: "fr", label: "Français", flag: "🇫🇷", theme: "france", translate: "auto" },
  { code: "it", chip: "IT", slug: "it", label: "Italiano", flag: "🇮🇹", theme: "italy", translate: "auto" },
  { code: "en", chip: "EN", slug: "en", label: "English", flag: "🇬🇧", theme: "uk", translate: "source" },
  { code: "es", chip: "ES", slug: "es", label: "Español", flag: "🇪🇸", theme: "spain", translate: "auto" },
  { code: "pt", chip: "PT", slug: "pt", label: "Português", flag: "🇧🇷", theme: "brazil", translate: "auto" },
  { code: "zh", chip: "中文", slug: "zh", label: "中文", flag: "🇨🇳", theme: "china", translate: "auto" },
] as const satisfies readonly Language[];

export type LangCode = (typeof languages)[number]["code"];

export const fallback: LangCode = "en";

/** Subset of languages for the business site. */
export const businessLanguages: readonly LangCode[] = ["en", "de"];

/** Accept-Language regional tags that map to a different internal code. */
export const regionalOverrides: Readonly<Record<string, LangCode>> = {
  "de-ch": "gsw",
  "de-li": "gsw",
  "fr-ch": "fr",
  "it-ch": "it",
};

export type Tone = "business" | "private" | "kids";

export const tone: Record<Tone, string> = {
  business: "professional, concise; German uses formal Sie",
  private: "warm, informal, friendly",
  kids: "playful, very simple words a 7-year-old understands, short sentences",
};

/** content.md pages and the tone each is translated with. */
export const contentPages = {
  common: "private",
  business: "business",
  private: "private",
  "kid-one": "kids",
  "kid-two": "kids",
} as const satisfies Record<string, Tone>;

export type ContentPage = keyof typeof contentPages;

/** Languages a content page is written and translated in. */
export function pageLanguages(page: string): readonly LangCode[] {
  return page === "business" ? businessLanguages : languages.map((l) => l.code);
}

/** Path segments used by the personal Worker itself. Page slugs must not collide with them. */
export const reservedSlugs = ["s", "r", "admin", "api", "_astro"] as const;

export type PersonalPageId = "private" | "kid-one" | "kid-two";

export interface PersonalPage {
  id: PersonalPageId;
  /** Neutral URL path segment. Reveals nothing about who the page is for. */
  slug: string;
  style: "calm" | "comic";
  /** Languages printed on the QR card ("Scan me"), first one is the card's main language. */
  cardLanguages: readonly LangCode[];
}

export const personalPages: readonly PersonalPage[] = [
  { id: "private", slug: "m", style: "calm", cardLanguages: ["en", "de"] },
  { id: "kid-one", slug: "k1", style: "comic", cardLanguages: ["gsw", "en"] },
  { id: "kid-two", slug: "k2", style: "comic", cardLanguages: ["gsw", "en"] },
];

/** QR token defaults. */
export const tokenDefaults = {
  expiryMonths: 12,
  cookieDays: 90,
};
