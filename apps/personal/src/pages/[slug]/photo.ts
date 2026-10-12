import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { notFound } from "../../lib/http.ts";
import { findMedia, MEDIA_HEADERS, mediaResponse } from "../../lib/media.ts";
import { pageBySlug } from "../../lib/pages.ts";

/** Marc's photo for the private page (R2 `media/photo.<webp|png|jpg>`). Kid pages never have photos. */
const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#C2410C"/><circle cx="32" cy="25" r="11" fill="#FFF" opacity=".9"/><path d="M12 58c3-12 11-18 20-18s17 6 20 18" fill="#FFF" opacity=".9"/></svg>`;

export const GET: APIRoute = async ({ params, locals }) => {
  const page = pageBySlug(params.slug);
  if (page?.style !== "calm" || !locals.pass) return notFound();
  const key = await findMedia(env.BUCKET, "media/photo");
  const res = key ? await mediaResponse(env.BUCKET, key, 86_400) : null;
  return (
    res ??
    new Response(PLACEHOLDER, {
      headers: { ...MEDIA_HEADERS, "content-type": "image/svg+xml", "cache-control": "private, max-age=300" },
    })
  );
};
