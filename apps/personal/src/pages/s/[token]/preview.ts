import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { tokenByValue } from "../../../lib/db.ts";
import { notFound } from "../../../lib/http.ts";
import { mediaResponse } from "../../../lib/media.ts";
import { pageById } from "../../../lib/pages.ts";
import { previewImageKey } from "../../../lib/preview.ts";
import { isTokenActive, TOKEN_RE } from "../../../lib/token.ts";

/** The link preview image for a valid token: the page's uploaded drawing or photo. */
export const GET: APIRoute = async ({ params }) => {
  const token = params.token ?? "";
  if (!TOKEN_RE.test(token)) return notFound();
  const row = await tokenByValue(env.DB, token);
  if (!isTokenActive(row)) return notFound();
  const page = pageById(row.page);
  const key = page && (await previewImageKey(env.BUCKET, page));
  return (key && (await mediaResponse(env.BUCKET, key, 3600))) || notFound();
};

export const ALL: APIRoute = () => notFound();
