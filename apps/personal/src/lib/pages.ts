import { languageByCode, languageBySlug } from "@marc/i18n";
import { languages, type PersonalPage, personalPages } from "../../../../site.config.ts";

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
