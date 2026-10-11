import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { verifyAccessJwt } from "./lib/access.ts";
import { COOKIE_NAME, readCookie, verifyPass } from "./lib/cookie.ts";
import { tokenById } from "./lib/db.ts";
import { notFound, ROBOTS } from "./lib/http.ts";
import { pageBySlug } from "./lib/pages.ts";
import { isTokenActive } from "./lib/token.ts";

/**
 * Gatekeeper. Every path is a plain, identical 404 unless:
 *  /s/<token>, /r/<code>  → the route validates its own token or signature
 *  /admin/…               → valid Cloudflare Access JWT
 *  /<page-slug>/…         → valid signed pass cookie for that page, backed by an active token
 */
export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await gate(ctx, next);
  const headers = new Headers(res.headers);
  headers.set("x-robots-tag", ROBOTS);
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});

async function gate(
  ctx: Parameters<Parameters<typeof defineMiddleware>[0]>[0],
  next: () => Promise<Response>,
) {
  const first = ctx.url.pathname.split("/").filter(Boolean)[0];
  if (first === "s" || first === "r") return next();

  if (first === "admin") {
    const host = ctx.url.hostname;
    if (env.ADMIN_DEV_BYPASS === "true" && (host === "localhost" || host === "127.0.0.1")) {
      ctx.locals.admin = { email: "dev@localhost" };
      return next();
    }
    const who = await verifyAccessJwt(
      ctx.request.headers.get("cf-access-jwt-assertion"),
      env.ACCESS_TEAM_DOMAIN,
      env.ACCESS_AUD,
    );
    if (!who) return notFound();
    ctx.locals.admin = who;
    return next();
  }

  const page = pageBySlug(first);
  if (!page) return notFound();
  const pass = await verifyPass(
    env.COOKIE_SIGNING_KEY,
    page.id,
    readCookie(ctx.request.headers.get("cookie"), COOKIE_NAME),
  );
  if (!pass) return notFound();
  const row = await tokenById(env.DB, pass.tokenId);
  if (!isTokenActive(row) || row.page !== page.id) return notFound();
  ctx.locals.pass = { page: page.id, tokenId: row.id, batch: row.batch };
  return next();
}
