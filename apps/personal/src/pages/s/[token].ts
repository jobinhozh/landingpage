import type { APIRoute } from "astro";
import { detectLanguage } from "@marc/i18n";
import { env } from "cloudflare:workers";
import { tokenDefaults } from "../../../../../site.config.ts";
import { passCookie, signPass } from "../../lib/cookie.ts";
import { recordScan, tokenByValue } from "../../lib/db.ts";
import { notFound, redirect } from "../../lib/http.ts";
import { keptQuery, pageById, pageLangCodes, pageUrl } from "../../lib/pages.ts";
import { isPreviewBot, previewHtml, previewImageKey } from "../../lib/preview.ts";
import { isTokenActive, TOKEN_RE, tokenExpiry } from "../../lib/token.ts";

/**
 * QR entry point: valid token → signed pass cookie for that page → clean URL in the detected language.
 * Link-preview crawlers (WhatsApp …) get the preview card instead, without cookie or scan count.
 */
export const GET: APIRoute = async ({ params, request, locals, url }) => {
  const token = params.token ?? "";
  if (!TOKEN_RE.test(token)) return notFound();
  const row = await tokenByValue(env.DB, token);
  if (!isTokenActive(row)) return notFound();
  const page = pageById(row.page);
  if (!page) return notFound();

  if (isPreviewBot(request.headers.get("user-agent"))) {
    // WhatsApp builds the preview on the sender's phone, so its language fits. Without one, the card's.
    const accept = request.headers.get("accept-language")?.replace(/[\s*]/g, "");
    const lang = accept ? detectLanguage(accept, pageLangCodes(page)) : page.cardLanguages[0]!;
    const image = (await previewImageKey(env.BUCKET, page)) ? `${url.origin}/s/${token}/preview` : null;
    return new Response(previewHtml({ page, lang, url: `${url.origin}/s/${token}`, image }), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const maxAge = tokenDefaults.cookieDays * 86_400;
  const tokenExp = Math.floor(tokenExpiry(row) / 1000);
  const exp = Math.min(Math.floor(Date.now() / 1000) + maxAge, tokenExp);
  const value = await signPass(env.COOKIE_SIGNING_KEY, { page: page.id, tokenId: row.id, exp });
  locals.cfContext.waitUntil(recordScan(env.DB, row.id));

  // ?hide=… on the QR link carries over, so a card can hide the travel or sport block.
  const lang = detectLanguage(request.headers.get("accept-language"), pageLangCodes(page));
  return redirect(`${pageUrl(page, lang)}${keptQuery(url)}`, 302, {
    "set-cookie": passCookie(value, page.slug, exp - Math.floor(Date.now() / 1000)),
    vary: "accept-language",
  });
};

export const ALL: APIRoute = () => notFound();
