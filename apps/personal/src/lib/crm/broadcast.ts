import { t } from "@marc/i18n/content";
import { hmac, hmacVerify } from "../crypto.ts";
import { parentEmailOn, sendResend } from "../notify.ts";
import { logInteraction } from "./families.ts";
import type { Adult, DB } from "./types.ts";

type Env = Cloudflare.Env;

// RSVP links: /r/<interactionId>-<adultId>.<sig>

export async function rsvpCode(secret: string, interactionId: number, adultId: number): Promise<string> {
  return `${interactionId}-${adultId}.${await hmac(secret, `rsvp:${interactionId}:${adultId}`)}`;
}

export async function parseRsvpCode(
  secret: string,
  code: string,
): Promise<{ interactionId: number; adultId: number } | null> {
  const m = /^(\d+)-(\d+)\.([A-Za-z0-9_-]{20,100})$/.exec(code);
  if (!m) return null;
  const interactionId = Number(m[1]);
  const adultId = Number(m[2]);
  return (await hmacVerify(secret, `rsvp:${interactionId}:${adultId}`, m[3]!))
    ? { interactionId, adultId }
    : null;
}

export interface RsvpTarget {
  familyId: number;
  subject: string;
  language: string;
}

/** The broadcast an RSVP link points to, only when the adult belongs to that family. */
export async function rsvpTarget(db: DB, interactionId: number, adultId: number): Promise<RsvpTarget | null> {
  return db
    .prepare(
      `SELECT i.family_id AS familyId, i.summary AS subject, a.language FROM interactions i JOIN adults a ON a.family_id = i.family_id
       WHERE i.id = ? AND i.kind = 'broadcast' AND a.id = ?`,
    )
    .bind(interactionId, adultId)
    .first<RsvpTarget>();
}

export async function recordRsvp(db: DB, target: RsvpTarget, yes: boolean): Promise<void> {
  await logInteraction(db, target.familyId, "rsvp", `${yes ? "yes" : "no"}: ${target.subject}`);
}

/** Opted-in adults of a page: families from that page or whose child knows that kid. */
export async function broadcastRecipients(db: DB, page: string): Promise<Adult[]> {
  const { results } = await db
    .prepare(
      `SELECT a.* FROM adults a JOIN families f ON f.id = a.family_id
       WHERE a.broadcast_opt_in = 1
         AND (f.source_page = ? OR EXISTS (SELECT 1 FROM children c WHERE c.family_id = f.id AND (',' || c.knows || ',') LIKE ?))
       ORDER BY a.id`,
    )
    .bind(page, `%,${page},%`)
    .all<Adult>();
  return results;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  skipped: number;
  /** Email to parents is off (no RESEND_API_KEY), nothing was sent. */
  emailOff?: boolean;
}

/** Each family gets an interaction entry; with RSVP the email carries a personal link. */
export async function broadcast(
  env: Env,
  origin: string,
  b: { page: string; subject: string; body: string; rsvp: boolean },
): Promise<BroadcastResult> {
  const res: BroadcastResult = { sent: 0, failed: 0, skipped: 0 };
  if (!parentEmailOn(env)) return { ...res, emailOff: true };
  for (const a of await broadcastRecipients(env.DB, b.page)) {
    if (!a.email) {
      res.skipped++;
      continue;
    }
    const interactionId = await logInteraction(env.DB, a.family_id, "broadcast", b.subject);
    let text = b.body.replace(/\{name\}/g, a.name);
    if (b.rsvp) {
      const code = await rsvpCode(env.COOKIE_SIGNING_KEY, interactionId, a.id);
      text += `\n\n${t("common", "rsvp_yes", a.language)} / ${t("common", "rsvp_no", a.language)}:\n${origin}/r/${code}`;
    }
    try {
      await sendResend(env, a.email, b.subject, text);
      res.sent++;
    } catch (e) {
      console.error("[broadcast]", e instanceof Error ? e.message : e);
      res.failed++;
    }
  }
  return res;
}
