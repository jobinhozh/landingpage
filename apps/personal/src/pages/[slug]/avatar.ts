import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { notFound } from "../../lib/http.ts";
import { findMedia, mediaResponse } from "../../lib/media.ts";
import { pageBySlug } from "../../lib/pages.ts";

/** A kid's own drawing (R2 `media/avatar-<page>.<ext>`). Without one the page shows the built-in drawn avatar. */
export const GET: APIRoute = async ({ params, locals }) => {
  const page = pageBySlug(params.slug);
  if (page?.style !== "comic" || !locals.pass) return notFound();
  const key = await findMedia(env.BUCKET, `media/avatar-${page.id}`);
  return (key && (await mediaResponse(env.BUCKET, key, 3600))) || notFound();
};
