import type { APIRoute } from "astro";
import { detectLanguage } from "@marc/i18n";
import { t } from "@marc/i18n/content";
import { themes } from "../../../../../themes.ts";
import { notFound } from "../../lib/http.ts";
import { allLanguages, pageBySlug } from "../../lib/pages.ts";

/** PWA manifest so parents can add the page to their home screen. */
export const GET: APIRoute = ({ params, request, locals }) => {
  const page = pageBySlug(params.slug);
  if (!page || !locals.pass) return notFound();
  const lang = detectLanguage(request.headers.get("accept-language"));
  const theme = themes[allLanguages.find((l) => l.code === lang)?.theme ?? "uk"]!;
  const name = t(page.id, "meta_title", lang);
  const manifest = {
    name,
    short_name: name.slice(0, 12),
    lang,
    start_url: `/${page.slug}/`,
    scope: `/${page.slug}/`,
    display: "standalone",
    background_color: page.style === "comic" ? theme.bg : "#EEF1EF",
    theme_color: page.style === "comic" ? "#111111" : "#EEF1EF",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json", "cache-control": "private, max-age=3600" },
  });
};
