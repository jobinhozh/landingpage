import { fromB64url } from "./crypto.ts";

/**
 * Verifies the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`).
 * Access already blocks unauthenticated requests at the edge; this check makes sure the
 * Worker never serves /admin if Access is misconfigured or bypassed via workers.dev.
 */
interface Jwk extends JsonWebKey {
  kid: string;
}

let cache: { url: string; at: number; keys: Jwk[] } | undefined;

async function keys(team: string): Promise<Jwk[]> {
  const url = `${team.replace(/\/$/, "")}/cdn-cgi/access/certs`;
  if (cache && cache.url === url && Date.now() - cache.at < 3_600_000) return cache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Access certs ${res.status}`);
  const data = (await res.json()) as { keys: Jwk[] };
  cache = { url, at: Date.now(), keys: data.keys };
  return data.keys;
}

function json<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(fromB64url(part))) as T;
}

export async function verifyAccessJwt(
  jwt: string | null,
  team: string,
  aud: string,
): Promise<{ email: string } | null> {
  if (!jwt || !team || !aud) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  try {
    const header = json<{ alg: string; kid: string }>(h);
    if (header.alg !== "RS256") return null;
    const jwk = (await keys(team)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      fromB64url(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!ok) return null;
    const claims = json<{ aud: string | string[]; exp: number; iss: string; email?: string }>(p);
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(aud)) return null;
    if (claims.exp * 1000 < Date.now()) return null;
    if (claims.iss !== team.replace(/\/$/, "")) return null;
    return { email: claims.email ?? "" };
  } catch {
    return null;
  }
}
