/// <reference types="@cloudflare/workers-types" />
import { detectLanguage, languageByCode } from "@marc/i18n";
import { businessLanguages } from "../../../site.config.ts";

interface Env {
  ASSETS: Fetcher;
}

/** "/" → detected language. All other paths are static assets. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const code = detectLanguage(request.headers.get("accept-language"), businessLanguages);
      const slug = languageByCode(code)?.slug ?? code;
      return new Response(null, {
        status: 302,
        headers: { location: `/${slug}/`, vary: "accept-language", "cache-control": "private, max-age=0" },
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
