/**
 * Images uploaded by Marc to R2 under `media/`, served only behind the pass cookie.
 * Never in git and never at a public URL.
 *   media/photo.<ext>          private page photo
 *   media/avatar-<page>.<ext>  a kid's own drawing, e.g. media/avatar-kid-one.png
 */
export const MEDIA_TYPES = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
} as const;

export type MediaExt = keyof typeof MEDIA_TYPES;

const ORDER = Object.keys(MEDIA_TYPES);

/**
 * The upload for `<base>` (e.g. `media/avatar-kid-one`), forgiving about how it was named:
 * any letter case and extra extensions such as `avatar-kid-one.jpg.jpeg` (Windows hides
 * extensions, so renames often add one). The last extension decides the type.
 * Preference by type follows MEDIA_TYPES order. One list call, whatever the result.
 */
export async function findMedia(bucket: R2Bucket, base: string): Promise<string | null> {
  const dir = base.slice(0, base.lastIndexOf("/") + 1);
  const name = base.slice(dir.length).toLowerCase();
  const { objects } = await bucket.list({ prefix: dir, limit: 1000 });
  let best: { key: string; rank: number } | null = null;
  for (const { key } of objects) {
    const file = key.slice(dir.length).toLowerCase();
    if (file.includes("/") || !file.startsWith(`${name}.`)) continue;
    const exts = file.slice(name.length + 1).split(".");
    if (exts.some((e) => !ORDER.includes(e))) continue;
    const rank = ORDER.indexOf(exts.at(-1)!);
    if (!best || rank < best.rank) best = { key, rank };
  }
  return best?.key ?? null;
}

export function mediaType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() as MediaExt | undefined;
  return (ext && MEDIA_TYPES[ext]) ?? "application/octet-stream";
}

/** Uploaded SVGs may carry script, so media is sandboxed even when opened directly. */
export const MEDIA_HEADERS = {
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
  "x-content-type-options": "nosniff",
};

export async function mediaResponse(bucket: R2Bucket, key: string, maxAge: number): Promise<Response | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return new Response(obj.body, {
    headers: {
      ...MEDIA_HEADERS,
      "content-type": mediaType(key),
      "cache-control": `private, max-age=${maxAge}`,
    },
  });
}
