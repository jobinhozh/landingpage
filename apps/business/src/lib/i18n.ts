import { languageByCode } from "@marc/i18n";
import { businessLanguages } from "../../../../site.config.ts";

export const PAGE = "business";

export const businessLangs = businessLanguages.map((code) => {
  const l = languageByCode(code);
  if (!l) throw new Error(`Unknown business language ${code}`);
  return l;
});

export function langPaths() {
  return businessLangs.map((l) => ({ params: { lang: l.slug }, props: { code: l.code as string } }));
}

export function slugOf(code: string): string {
  return languageByCode(code)?.slug ?? code;
}
