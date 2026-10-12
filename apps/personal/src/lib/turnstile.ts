/** Cloudflare's documented test secret that always passes. Answered locally so dev works offline. */
const TEST_PASS_SECRET = "1x0000000000000000000000000000000AA";

/** Server side Turnstile check. https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ */
export async function verifyTurnstile(
  secret: string,
  token: string | null,
  ip: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  if (secret === TEST_PASS_SECRET) return true;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
