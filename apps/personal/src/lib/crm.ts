import { t } from "@marc/i18n/content";
import type { PersonalPageId } from "../../../../site.config.ts";
import { hmac, hmacVerify } from "./crypto.ts";
import { findDuplicateFamily, mergeSet } from "./merge.ts";
import { sendResend } from "./notify.ts";
import { vcard, whatsappLink } from "./vcard.ts";

type Env = Cloudflare.Env;
type DB = D1Database;

export interface Submission {
  id: number;
  page: PersonalPageId;
  batch: string;
  lang: string;
  name: string;
  contact: string;
  email: string | null;
  phone: string | null;
  child_name: string | null;
  met_where: string | null;
  good_times: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

export interface Family {
  id: number;
  source_page: string | null;
  batch: string | null;
  first_contact_at: string;
  notes: string;
}

export interface Adult {
  id: number;
  family_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  language: string;
  broadcast_opt_in: number;
}

export interface Child {
  id: number;
  family_id: number;
  first_name: string;
  knows: string;
  met_where: string | null;
}

export interface Interaction {
  id: number;
  family_id: number;
  at: string;
  kind: string;
  summary: string;
}

export interface Reminder {
  id: number;
  family_id: number;
  due_on: string;
  text: string;
  done_at: string | null;
}

export async function pendingSubmissions(db: DB): Promise<Submission[]> {
  const { results } = await db
    .prepare("SELECT * FROM submissions WHERE status = 'pending' ORDER BY created_at DESC")
    .all<Submission>();
  return results;
}

export async function rejectSubmission(db: DB, id: number): Promise<void> {
  await db.prepare("DELETE FROM submissions WHERE id = ? AND status = 'pending'").bind(id).run();
}

export async function logInteraction(
  db: DB,
  familyId: number,
  kind: string,
  summary: string,
): Promise<number> {
  const row = await db
    .prepare("INSERT INTO interactions (family_id, kind, summary) VALUES (?, ?, ?) RETURNING id")
    .bind(familyId, kind, summary)
    .first<{ id: number }>();
  return row!.id;
}

export interface ApproveResult {
  familyId: number;
  merged: boolean;
  emailed: boolean;
  /** For phone-only contacts: a WhatsApp link with a prefilled hello for Marc to send manually. */
  whatsappHello?: string;
  error?: string;
}

/** Approve: create or merge the family, log it, send the parent Marc's vCard and WhatsApp link. */
export async function approveSubmission(env: Env, id: number): Promise<ApproveResult | null> {
  const db = env.DB;
  const s = await db
    .prepare("SELECT * FROM submissions WHERE id = ? AND status = 'pending'")
    .bind(id)
    .first<Submission>();
  if (!s) return null;

  const { results: adults } = await db.prepare("SELECT id, family_id, email, phone FROM adults").all<Adult>();
  const dup = findDuplicateFamily(
    adults.map((a) => ({ familyId: a.family_id, email: a.email, phone: a.phone })),
    { email: s.email, phone: s.phone },
  );

  let familyId = dup;
  if (familyId === null) {
    const f = await db
      .prepare("INSERT INTO families (source_page, batch, first_contact_at) VALUES (?, ?, ?) RETURNING id")
      .bind(s.page, s.batch, s.created_at)
      .first<{ id: number }>();
    familyId = f!.id;
    await db
      .prepare(
        "INSERT INTO adults (family_id, name, phone, email, whatsapp, language) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(familyId, s.name, s.phone, s.email, s.phone, s.lang)
      .run();
  } else {
    // Fill in what the existing record lacks, never overwrite.
    const same = adults.find(
      (a) =>
        a.family_id === familyId && ((s.email && a.email === s.email) || (s.phone && a.phone === s.phone)),
    );
    if (same) {
      await db
        .prepare(
          "UPDATE adults SET email = COALESCE(email, ?), phone = COALESCE(phone, ?), whatsapp = COALESCE(whatsapp, ?) WHERE id = ?",
        )
        .bind(s.email, s.phone, s.phone, same.id)
        .run();
    }
  }

  if (s.child_name) {
    const child = await db
      .prepare("SELECT * FROM children WHERE family_id = ? AND lower(first_name) = lower(?)")
      .bind(familyId, s.child_name)
      .first<Child>();
    if (child) {
      await db
        .prepare("UPDATE children SET knows = ? WHERE id = ?")
        .bind(mergeSet(child.knows, [s.page]), child.id)
        .run();
    } else {
      await db
        .prepare("INSERT INTO children (family_id, first_name, knows, met_where) VALUES (?, ?, ?, ?)")
        .bind(familyId, s.child_name, s.page, s.met_where)
        .run();
    }
  }

  const details = [s.met_where && `met: ${s.met_where}`, s.good_times && `times: ${s.good_times}`, s.message]
    .filter(Boolean)
    .join(" · ");
  await logInteraction(
    db,
    familyId,
    "approved",
    `Form via ${s.page} (${s.batch})${details ? `: ${details}` : ""}`,
  );
  await db
    .prepare("UPDATE submissions SET status = 'approved', family_id = ? WHERE id = ?")
    .bind(familyId, id)
    .run();

  const result: ApproveResult = { familyId, merged: dup !== null, emailed: false };
  const whatsapp = env.OWNER_PHONE ? whatsappLink(env.OWNER_PHONE) : "";
  const vars = { name: s.name, whatsapp };
  if (s.email) {
    try {
      await sendResend(
        env,
        s.email,
        t(s.page, "approve_subject", s.lang, vars),
        t(s.page, "approve_body", s.lang, vars),
        [{ filename: "contact.vcf", content: ownerVCard(env) }],
      );
      result.emailed = true;
      await logInteraction(db, familyId, "email", "Sent contact card");
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
    }
  } else if (s.phone) {
    const text = t(s.page, "approve_whatsapp", s.lang, vars);
    result.whatsappHello = `${whatsappLink(s.phone)}?text=${encodeURIComponent(text)}`;
  }
  return result;
}

export function ownerVCard(env: Env): string {
  return vcard({ name: env.OWNER_NAME ?? "Marc", phone: env.OWNER_PHONE, email: env.OWNER_EMAIL });
}

export interface FamilyFilter {
  q?: string;
  page?: string;
  tag?: string;
  lang?: string;
  unseenMonths?: number;
}

export interface FamilyRow extends Family {
  adults: string;
  children: string;
  tags: string;
  last_at: string;
}

/** Search across all fields plus filters. "Not seen in X months" uses the last interaction. */
export async function searchFamilies(db: DB, f: FamilyFilter): Promise<FamilyRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(`(f.notes LIKE ? OR f.batch LIKE ?
      OR EXISTS (SELECT 1 FROM adults a WHERE a.family_id = f.id AND (a.name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?))
      OR EXISTS (SELECT 1 FROM children c WHERE c.family_id = f.id AND (c.first_name LIKE ? OR c.met_where LIKE ?))
      OR EXISTS (SELECT 1 FROM interactions i WHERE i.family_id = f.id AND i.summary LIKE ?))`);
    args.push(like, like, like, like, like, like, like, like);
  }
  if (f.page) {
    where.push(
      "(f.source_page = ? OR EXISTS (SELECT 1 FROM children c WHERE c.family_id = f.id AND (',' || c.knows || ',') LIKE ?))",
    );
    args.push(f.page, `%,${f.page},%`);
  }
  if (f.tag) {
    where.push(
      "EXISTS (SELECT 1 FROM family_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.family_id = f.id AND t.name = ?)",
    );
    args.push(f.tag);
  }
  if (f.lang) {
    where.push("EXISTS (SELECT 1 FROM adults a WHERE a.family_id = f.id AND a.language = ?)");
    args.push(f.lang);
  }
  let having = "";
  if (f.unseenMonths && f.unseenMonths > 0) {
    having = "HAVING last_at < datetime('now', ?)";
    args.push(`-${Math.floor(f.unseenMonths)} months`);
  }
  const sql = `
    SELECT f.*,
      (SELECT group_concat(name, ', ') FROM adults a WHERE a.family_id = f.id) AS adults,
      (SELECT group_concat(first_name, ', ') FROM children c WHERE c.family_id = f.id) AS children,
      (SELECT group_concat(t.name, ', ') FROM family_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.family_id = f.id) AS tags,
      COALESCE((SELECT max(at) FROM interactions i WHERE i.family_id = f.id AND i.kind NOT IN ('broadcast', 'email')), f.first_contact_at) AS last_at
    FROM families f
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY f.id ${having}
    ORDER BY last_at DESC
    LIMIT 200`;
  const { results } = await db
    .prepare(sql)
    .bind(...args)
    .all<FamilyRow>();
  return results;
}

export async function getFamily(db: DB, id: number) {
  const family = await db.prepare("SELECT * FROM families WHERE id = ?").bind(id).first<Family>();
  if (!family) return null;
  const [adults, children, interactions, reminders, tags] = await db.batch([
    db.prepare("SELECT * FROM adults WHERE family_id = ? ORDER BY id").bind(id),
    db.prepare("SELECT * FROM children WHERE family_id = ? ORDER BY id").bind(id),
    db.prepare("SELECT * FROM interactions WHERE family_id = ? ORDER BY at DESC, id DESC").bind(id),
    db.prepare("SELECT * FROM reminders WHERE family_id = ? ORDER BY done_at IS NOT NULL, due_on").bind(id),
    db
      .prepare(
        "SELECT t.name FROM family_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.family_id = ? ORDER BY t.name",
      )
      .bind(id),
  ]);
  return {
    family,
    adults: adults!.results as unknown as Adult[],
    children: children!.results as unknown as Child[],
    interactions: interactions!.results as unknown as Interaction[],
    reminders: reminders!.results as unknown as Reminder[],
    tags: (tags!.results as unknown as { name: string }[]).map((r) => r.name),
  };
}

export async function addTag(db: DB, familyId: number, name: string): Promise<void> {
  const tag = name.trim().slice(0, 40);
  if (!tag) return;
  await db.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING").bind(tag).run();
  await db
    .prepare("INSERT OR IGNORE INTO family_tags (family_id, tag_id) SELECT ?, id FROM tags WHERE name = ?")
    .bind(familyId, tag)
    .run();
}

export async function removeTag(db: DB, familyId: number, name: string): Promise<void> {
  await db
    .prepare("DELETE FROM family_tags WHERE family_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)")
    .bind(familyId, name)
    .run();
}

export async function allTags(db: DB): Promise<string[]> {
  const { results } = await db.prepare("SELECT name FROM tags ORDER BY name").all<{ name: string }>();
  return results.map((r) => r.name);
}

export async function deleteFamily(db: DB, id: number): Promise<void> {
  // ON DELETE CASCADE needs foreign keys on; D1 enforces them by default. Delete explicitly anyway.
  await db.batch([
    db.prepare("DELETE FROM submissions WHERE family_id = ?").bind(id),
    db.prepare("DELETE FROM family_tags WHERE family_id = ?").bind(id),
    db.prepare("DELETE FROM reminders WHERE family_id = ?").bind(id),
    db.prepare("DELETE FROM interactions WHERE family_id = ?").bind(id),
    db.prepare("DELETE FROM children WHERE family_id = ?").bind(id),
    db.prepare("DELETE FROM adults WHERE family_id = ?").bind(id),
    db.prepare("DELETE FROM families WHERE id = ?").bind(id),
  ]);
}

export interface ManualFamily {
  adultName: string;
  email: string | null;
  phone: string | null;
  language: string;
  childName: string | null;
  knows: string[];
  metWhere: string | null;
  notes: string;
}

/** Manual add for people met without a card. */
export async function createFamily(db: DB, m: ManualFamily): Promise<number> {
  const f = await db
    .prepare("INSERT INTO families (source_page, batch, notes) VALUES ('manual', NULL, ?) RETURNING id")
    .bind(m.notes)
    .first<{ id: number }>();
  const id = f!.id;
  await db
    .prepare(
      "INSERT INTO adults (family_id, name, phone, email, whatsapp, language) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, m.adultName, m.phone, m.email, m.phone, m.language)
    .run();
  if (m.childName) {
    await db
      .prepare("INSERT INTO children (family_id, first_name, knows, met_where) VALUES (?, ?, ?, ?)")
      .bind(id, m.childName, mergeSet(null, m.knows), m.metWhere)
      .run();
  }
  await logInteraction(db, id, "manual", "Added manually");
  return id;
}

export interface BatchRow {
  id: number;
  page: string;
  batch: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  scans: number;
  last_scan_at: string | null;
  pending: number;
  approved: number;
}

export async function listBatches(db: DB): Promise<BatchRow[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*,
        (SELECT count(*) FROM submissions s WHERE s.page = t.page AND s.batch = t.batch AND s.status = 'pending') AS pending,
        (SELECT count(*) FROM submissions s WHERE s.page = t.page AND s.batch = t.batch AND s.status = 'approved') AS approved
       FROM tokens t ORDER BY t.created_at DESC`,
    )
    .all<BatchRow>();
  return results;
}

export async function revokeToken(db: DB, id: number): Promise<void> {
  await db
    .prepare("UPDATE tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL")
    .bind(id)
    .run();
}

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

export interface BroadcastResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Opt-in broadcast to approved contacts of a page (families from that page or whose child knows that kid).
 * Each family gets an interaction entry; with RSVP the email carries a personal link.
 */
export async function broadcast(
  env: Env,
  origin: string,
  b: { page: string; subject: string; body: string; rsvp: boolean },
): Promise<BroadcastResult> {
  const { results } = await env.DB.prepare(
    `SELECT a.* FROM adults a JOIN families f ON f.id = a.family_id
     WHERE a.broadcast_opt_in = 1
       AND (f.source_page = ? OR EXISTS (SELECT 1 FROM children c WHERE c.family_id = f.id AND (',' || c.knows || ',') LIKE ?))`,
  )
    .bind(b.page, `%,${b.page},%`)
    .all<Adult>();
  const res: BroadcastResult = { sent: 0, failed: 0, skipped: 0 };
  for (const a of results) {
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
      console.error("[broadcast]", e);
      res.failed++;
    }
  }
  return res;
}
