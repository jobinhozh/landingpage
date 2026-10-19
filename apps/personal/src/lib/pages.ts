import { languageByCode, languageBySlug } from "@marc/i18n";
import { languages, type PersonalPage, pageLanguages, personalPages } from "../../../../site.config.ts";

export function pageBySlug(slug: string | undefined): PersonalPage | undefined {
  return personalPages.find((p) => p.slug === slug);
}

export function pageById(id: string): PersonalPage | undefined {
  return personalPages.find((p) => p.id === id);
}

export function langFromSlug(slug: string | undefined) {
  return slug ? languageBySlug(slug) : undefined;
}

export function langSlug(code: string): string {
  return languageByCode(code)?.slug ?? code;
}

export function pageUrl(page: PersonalPage, code: string, rest = ""): string {
  return `/${page.slug}/${langSlug(code)}${rest ? `/${rest}` : ""}`;
}

export const allLanguages = languages;

/** Languages a page is published in (private: the ones Marc speaks, kids: all). */
export function languagesOf(page: PersonalPage) {
  const codes: readonly string[] = pageLanguages(page.id);
  return languages.filter((l) => codes.includes(l.code));
}

export const pageLangCodes = (page: PersonalPage): string[] => languagesOf(page).map((l) => l.code);

/** Query parameters that survive language switches and redirects (e.g. ?show=sport). */
export function keptQuery(url: URL): string {
  const show = url.searchParams.get("show");
  return show ? `?show=${encodeURIComponent(show)}` : "";
}
