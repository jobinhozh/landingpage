import { t } from "@marc/i18n/content";
import { findDuplicateFamily, mergeSet } from "../merge.ts";
import { parentEmailOn, sendResend } from "../notify.ts";
import { vcard, whatsappLink } from "../vcard.ts";
import { logInteraction } from "./families.ts";
import type { Adult, Child, DB, Submission } from "./types.ts";

type Env = Cloudflare.Env;

export async function pendingSubmissions(db: DB): Promise<Submission[]> {
  const { results } = await db
    .prepare("SELECT * FROM submissions WHERE status = 'pending' ORDER BY created_at DESC")
    .all<Submission>();
  return results;
}

export async function rejectSubmission(db: DB, id: number): Promise<void> {
  await db.prepare("DELETE FROM submissions WHERE id = ? AND status = 'pending'").bind(id).run();
}

/** Writes the CRM side of an approval in one D1 transaction. Returns the family id. */
export async function mergeIntoCrm(db: DB, s: Submission): Promise<{ familyId: number; merged: boolean }> {
  const { results: adults } = await db.prepare("SELECT id, family_id, email, phone FROM adults").all<Adult>();
  const dup = findDuplicateFamily(
    adults.map((a) => ({ familyId: a.family_id, email: a.email, phone: a.phone })),
    { email: s.email, phone: s.phone },
  );
  // Inside the batch transaction the newest family row is the one inserted first.
  const fam = dup === null ? { sql: "(SELECT max(id) FROM families)", args: [] } : { sql: "?", args: [dup] };
  const stmts: D1PreparedStatement[] = [];

  if (dup === null) {
    stmts.push(
      db
        .prepare("INSERT INTO families (source_page, batch, first_contact_at) VALUES (?, ?, ?)")
        .bind(s.page, s.batch, s.created_at),
      db
        .prepare(
          `INSERT INTO adults (family_id, name, phone, email, whatsapp, language) VALUES (${fam.sql}, ?, ?, ?, ?, ?)`,
        )
        .bind(s.name, s.phone, s.email, s.phone, s.lang),
    );
  } else {
    // Fill in what the existing adult lacks, never overwrite.
    const same = adults.find(
      (a) => a.family_id === dup && ((s.email && a.email === s.email) || (s.phone && a.phone === s.phone)),
    );
    if (same) {
      stmts.push(
        db
          .prepare(
            "UPDATE adults SET email = COALESCE(email, ?), phone = COALESCE(phone, ?), whatsapp = COALESCE(whatsapp, ?) WHERE id = ?",
          )
          .bind(s.email, s.phone, s.phone, same.id),
      );
    }
  }

  if (s.child_name) {
    const child =
      dup === null
        ? null
        : await db
            .prepare("SELECT * FROM children WHERE family_id = ? AND lower(first_name) = lower(?)")
            .bind(dup, s.child_name)
            .first<Child>();
    stmts.push(
      child
        ? db
            .prepare("UPDATE children SET knows = ? WHERE id = ?")
            .bind(mergeSet(child.knows, [s.page]), child.id)
        : db
            .prepare(
              `INSERT INTO children (family_id, first_name, knows, met_where) VALUES (${fam.sql}, ?, ?, ?)`,
            )
            .bind(...fam.args, s.child_name, s.page, s.met_where),
    );
  }

  const details = [s.met_where && `met: ${s.met_where}`, s.good_times && `times: ${s.good_times}`, s.message]
    .filter(Boolean)
    .join(" · ");
  stmts.push(
    db
      .prepare(`INSERT INTO interactions (family_id, kind, summary) VALUES (${fam.sql}, 'approved', ?)`)
      .bind(...fam.args, `Form via ${s.page} (${s.batch})${details ? `: ${details}` : ""}`),
    db
      .prepare(
        `UPDATE submissions SET status = 'approved', family_id = ${fam.sql} WHERE id = ? AND status = 'pending'`,
      )
      .bind(...fam.args, s.id),
    db.prepare("SELECT family_id FROM submissions WHERE id = ?").bind(s.id),
  );

  const res = await db.batch<{ family_id: number }>(stmts);
  const familyId = res.at(-1)!.results[0]!.family_id;
  return { familyId, merged: dup !== null };
}

export interface ApproveResult {
  familyId: number;
  merged: boolean;
  emailed: boolean;
  /** Email to parents is off (no RESEND_API_KEY): Marc gets in touch himself. */
  emailOff?: boolean;
  /** For phone-only contacts: a WhatsApp link with a prefilled hello for Marc to send manually. */
  whatsappHello?: string;
  error?: string;
}

/** Approve: create or merge the family, log it, send the parent Marc's vCard and WhatsApp link. */
export async function approveSubmission(env: Env, id: number): Promise<ApproveResult | null> {
  const s = await env.DB.prepare("SELECT * FROM submissions WHERE id = ? AND status = 'pending'")
    .bind(id)
    .first<Submission>();
  if (!s) return null;
  const { familyId, merged } = await mergeIntoCrm(env.DB, s);

  const result: ApproveResult = { familyId, merged, emailed: false };
  const vars = { name: s.name, whatsapp: env.OWNER_PHONE ? whatsappLink(env.OWNER_PHONE) : "" };
  if (s.email && !parentEmailOn(env)) result.emailOff = true;
  if (s.email && !result.emailOff) {
    try {
      await sendResend(
        env,
        s.email,
        t(s.page, "approve_subject", s.lang, vars),
        t(s.page, "approve_body", s.lang, vars),
        [{ filename: "contact.vcf", content: ownerVCard(env) }],
      );
      result.emailed = true;
      await logInteraction(env.DB, familyId, "email", "Sent contact card");
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
    }
  }
  if (!result.emailed && !result.error && s.phone) {
    result.whatsappHello = `${whatsappLink(s.phone)}?text=${encodeURIComponent(t(s.page, "approve_whatsapp", s.lang, vars))}`;
  }
  return result;
}

export function ownerVCard(env: Env): string {
  return vcard({ name: env.OWNER_NAME ?? "Marc", phone: env.OWNER_PHONE, email: env.OWNER_EMAIL });
}
