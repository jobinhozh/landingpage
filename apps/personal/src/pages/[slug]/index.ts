import type { APIRoute } from "astro";
import { detectLanguage } from "@marc/i18n";
import { notFound, redirect } from "../../lib/http.ts";
import { pageBySlug, pageUrl } from "../../lib/pages.ts";

/** /<slug> → /<slug>/<detected language> */
export const GET: APIRoute = ({ params, request, locals }) => {
  const page = pageBySlug(params.slug);
  if (!page || !locals.pass) return notFound();
  return redirect(pageUrl(page, detectLanguage(request.headers.get("accept-language"))), 302, {
    vary: "accept-language",
  });
};

export const ALL: APIRoute = () => notFound();
