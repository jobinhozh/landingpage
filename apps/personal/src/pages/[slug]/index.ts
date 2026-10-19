import type { APIRoute } from "astro";
import { detectLanguage } from "@marc/i18n";
import { notFound, redirect } from "../../lib/http.ts";
import { keptQuery, pageBySlug, pageLangCodes, pageUrl } from "../../lib/pages.ts";

/** /<slug> → /<slug>/<detected language> */
export const GET: APIRoute = ({ params, request, locals, url }) => {
  const page = pageBySlug(params.slug);
  if (!page || !locals.pass) return notFound();
  const code = detectLanguage(request.headers.get("accept-language"), pageLangCodes(page));
  return redirect(`${pageUrl(page, code)}${keptQuery(url)}`, 302, {
    vary: "accept-language",
  });
};

export const ALL: APIRoute = () => notFound();
