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

/** First existing `<base>.<ext>` in R2, in MEDIA_TYPES order. One list call, whatever the result. */
export async function findMedia(bucket: R2Bucket, base: string): Promise<string | null> {
  const { objects } = await bucket.list({ prefix: `${base}.`, limit: 20 });
  const keys = new Set(objects.map((o) => o.key));
  for (const ext of Object.keys(MEDIA_TYPES)) {
    if (keys.has(`${base}.${ext}`)) return `${base}.${ext}`;
  }
  return null;
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
