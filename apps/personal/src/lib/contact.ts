import type { APIContext, AstroGlobal } from "astro";
import { env } from "cloudflare:workers";
import { t } from "@marc/i18n/content";
import type { PersonalPage } from "../../../../site.config.ts";
import { insertSubmission } from "./db.ts";
import { background, emailOwner, push, sendResend } from "./notify.ts";
import { pageUrl } from "./pages.ts";
import { verifyTurnstile } from "./turnstile.ts";
import { type ContactInput, validateContact } from "./validation.ts";

export interface FormState {
  values: Record<string, string | string[]>;
  errors: Record<string, string>;
  formError?: string;
}

type Ctx = AstroGlobal | APIContext;

/** Contact flow: rate limit → validate → Turnstile → save → notify Marc → auto-reply. */
export async function handleContact(
  ctx: Ctx,
  page: PersonalPage,
  lang: string,
): Promise<Response | FormState> {
  const pass = ctx.locals.pass!;
  const ip = ctx.request.headers.get("cf-connecting-ip") ?? "local";
  const form = await ctx.request.formData();
  const values = Object.fromEntries(
    ["name", "contact", "child_name", "met_where", "message", "consent"].map((k) => [
      k,
      String(form.get(k) ?? ""),
    ]),
  ) as Record<string, string | string[]>;
  values.times = form.getAll("times").map(String);
  const msg = (key: string) => t(page.id, key, lang);

  const [byIp, byToken] = await Promise.all([
    env.RL_IP.limit({ key: `ip:${ip}` }),
    env.RL_TOKEN.limit({ key: `token:${pass.tokenId}` }),
  ]);
  if (!byIp.success || !byToken.success) return { values, errors: {}, formError: msg("error_rate") };

  const result = validateContact(form, page.id);
  const sentUrl = `${pageUrl(page, lang)}?sent=1`;
  if (result.bot) return ctx.redirect(sentUrl, 303);
  if (!result.ok) {
    const errors: Record<string, string> = {};
    for (const [field, key] of Object.entries(result.errors)) {
      errors[field === "childName" ? "child_name" : field] = msg(key);
    }
    return { values, errors };
  }

  const human = await verifyTurnstile(
    env.TURNSTILE_SECRET,
    form.get("cf-turnstile-response") as string | null,
    ip,
  );
  if (!human) return { values, errors: {}, formError: msg("error_spam") };

  try {
    await insertSubmission(env.DB, { page: page.id, batch: pass.batch, lang, data: result.data });
  } catch (e) {
    console.error("[submission]", e);
    return { values, errors: {}, formError: msg("error_generic") };
  }

  const cf = ctx.locals.cfContext;
  const adminUrl = `${new URL(ctx.request.url).origin}/admin`;
  background(
    cf,
    "email-owner",
    emailOwner(env, `New contact via ${page.id}`, ownerText(page, lang, pass.batch, result.data, adminUrl)),
  );
  background(cf, "push", push(env, "New contact", `${page.id} · ${lang}`, adminUrl));
  if (result.data.email) {
    const vars = { name: result.data.name };
    background(
      cf,
      "autoreply",
      sendResend(
        env,
        result.data.email,
        t(page.id, "autoreply_subject", lang, vars),
        t(page.id, "autoreply_body", lang, vars),
      ),
    );
  }
  return ctx.redirect(sentUrl, 303);
}

function ownerText(
  page: PersonalPage,
  lang: string,
  batch: string,
  d: ContactInput,
  adminUrl: string,
): string {
  return [
    `Page: ${page.id} (batch ${batch}, ${lang})`,
    `Name: ${d.name}`,
    `Contact: ${d.contact}`,
    d.childName ? `Child: ${d.childName}` : "",
    d.metWhere ? `Met: ${d.metWhere}` : "",
    d.goodTimes.length ? `Good times: ${d.goodTimes.join(", ")}` : "",
    d.message ? `\n${d.message}\n` : "",
    `Approve or reject: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}
