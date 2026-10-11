import { readFileSync } from "node:fs";
import type { AstroIntegration } from "astro";
import { parseContent, validateConfig, validateContent } from "@marc/i18n";

/**
 * Validates site.config.ts and content.md before every build.
 * Errors stop the build. Missing translations are listed as warnings, grouped by language.
 */
export function contentCheck(contentPath: URL): AstroIntegration {
  return {
    name: "marc:content-check",
    hooks: {
      "astro:config:setup": ({ logger }) => {
        const doc = parseContent(readFileSync(contentPath, "utf8"));
        const { errors, warnings } = validateContent(doc);
        const all = [...validateConfig(), ...errors];
        if (all.length) throw new Error(`Content validation failed:\n${all.join("\n")}`);
        if (!warnings.length) return;
        const byLang = new Map<string, string[]>();
        for (const w of warnings) {
          const m = /^(?:missing|orphan key) ([^/]+)\/([^/]+)\/(\S+)/.exec(w);
          const lang = m?.[2] ?? "?";
          byLang.set(lang, [...(byLang.get(lang) ?? []), m ? `${m[1]}/${m[3]}` : w]);
        }
        logger.warn(`content.md: ${warnings.length} missing or orphan translations (run npm run translate)`);
        for (const [lang, keys] of byLang) {
          logger.warn(
            `  ${lang}: ${keys.length} → ${keys.slice(0, 8).join(", ")}${keys.length > 8 ? ", …" : ""}`,
          );
        }
      },
    },
  };
}
