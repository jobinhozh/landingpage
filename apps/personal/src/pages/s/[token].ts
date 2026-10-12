import type { APIRoute } from "astro";
import { detectLanguage } from "@marc/i18n";
import { env } from "cloudflare:workers";
import { tokenDefaults } from "../../../../../site.config.ts";
import { passCookie, signPass } from "../../lib/cookie.ts";
import { recordScan, tokenByValue } from "../../lib/db.ts";
import { notFound, redirect } from "../../lib/http.ts";
import { pageById, pageUrl } from "../../lib/pages.ts";
import { isTokenActive, TOKEN_RE, tokenExpiry } from "../../lib/token.ts";

/** QR entry point: valid token → signed pass cookie for that page → clean URL in the detected language. */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const token = params.token ?? "";
  if (!TOKEN_RE.test(token)) return notFound();
  const row = await tokenByValue(env.DB, token);
  if (!isTokenActive(row)) return notFound();
  const page = pageById(row.page);
  if (!page) return notFound();

  const maxAge = tokenDefaults.cookieDays * 86_400;
  const tokenExp = Math.floor(tokenExpiry(row) / 1000);
  const exp = Math.min(Math.floor(Date.now() / 1000) + maxAge, tokenExp);
  const value = await signPass(env.COOKIE_SIGNING_KEY, { page: page.id, tokenId: row.id, exp });
  locals.cfContext.waitUntil(recordScan(env.DB, row.id));

  const lang = detectLanguage(request.headers.get("accept-language"));
  return redirect(pageUrl(page, lang), 302, {
    "set-cookie": passCookie(value, page.slug, exp - Math.floor(Date.now() / 1000)),
    vary: "accept-language",
  });
};

export const ALL: APIRoute = () => notFound();
