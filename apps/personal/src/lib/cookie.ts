import { hmac, hmacVerify } from "./crypto.ts";

export const COOKIE_NAME = "__Secure-pass";

export interface PassPayload {
  page: string;
  tokenId: number;
  /** Unix seconds. */
  exp: number;
}

/** `<tokenId>.<exp>.<sig>`, the signature covers the page as well. */
export async function signPass(secret: string, p: PassPayload): Promise<string> {
  const sig = await hmac(secret, `pass:${p.page}:${p.tokenId}:${p.exp}`);
  return `${p.tokenId}.${p.exp}.${sig}`;
}

export async function verifyPass(
  secret: string,
  page: string,
  value: string | undefined,
  now = Date.now(),
): Promise<PassPayload | null> {
  if (!value) return null;
  const m = /^(\d{1,12})\.(\d{1,12})\.([A-Za-z0-9_-]{20,100})$/.exec(value);
  if (!m) return null;
  const tokenId = Number(m[1]);
  const exp = Number(m[2]);
  if (exp * 1000 <= now) return null;
  const ok = await hmacVerify(secret, `pass:${page}:${tokenId}:${exp}`, m[3]!);
  return ok ? { page, tokenId, exp } : null;
}

export function passCookie(value: string, slug: string, maxAgeSeconds: number): string {
  return [
    `${COOKIE_NAME}=${value}`,
    `Path=/${slug}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}
