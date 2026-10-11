type Env = Cloudflare.Env;

/** Email to Marc through Email Routing (destination must be a verified address). */
export async function emailOwner(env: Env, subject: string, text: string): Promise<void> {
  if (!env.NOTIFY_EMAIL) return;
  await env.NOTIFY.send({ from: env.NOTIFY_FROM, to: env.NOTIFY_EMAIL, subject, text });
}

/** Push to Marc's phone. Keep the text free of personal data, it passes through the ntfy server. */
export async function push(env: Env, title: string, message: string, click?: string): Promise<void> {
  if (!env.NTFY_TOPIC) return;
  const headers: Record<string, string> = { Title: title, Tags: "wave" };
  if (click) headers.Click = click;
  await fetch(`${env.NTFY_SERVER.replace(/\/$/, "")}/${env.NTFY_TOPIC}`, {
    method: "POST",
    body: message,
    headers,
  });
}

export interface Attachment {
  filename: string;
  content: string;
}

/** Email to a parent through Resend. */
export async function sendResend(
  env: Env,
  to: string,
  subject: string,
  text: string,
  attachments: Attachment[] = [],
): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [to],
      subject,
      text,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: base64(a.content),
      })),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

/** Runs notifications in the background and never lets them break the request. */
export function background(ctx: ExecutionContext, label: string, task: Promise<unknown>): void {
  ctx.waitUntil(task.catch((e: unknown) => console.error(`[${label}]`, e instanceof Error ? e.message : e)));
}

function base64(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
