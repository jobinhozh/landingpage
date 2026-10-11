import type { PersonalPageId } from "../../../../site.config.ts";
import type { TokenRow } from "./token.ts";
import type { ContactInput } from "./validation.ts";

export type DB = D1Database;

export async function tokenByValue(db: DB, token: string): Promise<TokenRow | null> {
  return db
    .prepare("SELECT id, token, page, batch, expires_at, revoked_at FROM tokens WHERE token = ?")
    .bind(token)
    .first<TokenRow>();
}

export async function tokenById(db: DB, id: number): Promise<TokenRow | null> {
  return db
    .prepare("SELECT id, token, page, batch, expires_at, revoked_at FROM tokens WHERE id = ?")
    .bind(id)
    .first<TokenRow>();
}

export async function recordScan(db: DB, id: number): Promise<void> {
  await db
    .prepare("UPDATE tokens SET scans = scans + 1, last_scan_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}

export async function insertSubmission(
  db: DB,
  s: { page: PersonalPageId; batch: string; lang: string; data: ContactInput },
): Promise<number> {
  const d = s.data;
  const row = await db
    .prepare(
      `INSERT INTO submissions (page, batch, lang, name, contact, email, phone, child_name, met_where, good_times, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      s.page,
      s.batch,
      s.lang,
      d.name,
      d.contact,
      d.email,
      d.phone,
      d.childName,
      d.metWhere,
      d.goodTimes.join(",") || null,
      d.message,
    )
    .first<{ id: number }>();
  return row!.id;
}
