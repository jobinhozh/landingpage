import { setting } from "@marc/i18n/content";

export const ROBOTS = "noindex, nofollow, noarchive, nosnippet";

/** The one and only 404. Identical for every path, so nothing reveals which pages exist. */
export function notFound(): Response {
  return new Response(setting("common", "not_found"), {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": ROBOTS,
    },
  });
}

export function redirect(location: string, status = 302, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { location, "cache-control": "no-store", ...headers } });
}
