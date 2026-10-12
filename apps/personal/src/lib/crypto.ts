/** WebCrypto helpers, identical in Workers, Node 22 and the browser. */

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
    keyCache.set(secret, k);
  }
  return k;
}

export async function hmac(secret: string, data: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data)));
}

/** Constant time verification through WebCrypto. */
export async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromB64url(sig);
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, enc.encode(data));
}

export async function sha256(data: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(data)));
}

/** URL safe random token, 128 bit by default. */
export function randomToken(bytes = 16): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
