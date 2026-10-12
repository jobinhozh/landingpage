import { mergeSet } from "../merge.ts";
import type { Adult, Child, DB, Family, Interaction, Reminder } from "./types.ts";

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

// Search

export interface FamilyFilter {
  q?: string;
  page?: string;
  tag?: string;
  lang?: string;
  unseenMonths?: number;
}

/** Reads the filter from a query string (people list, exports). */
export function filterFromParams(p: URLSearchParams): FamilyFilter {
  return {
    q: p.get("q")?.trim() || undefined,
    page: p.get("page") || undefined,
    tag: p.get("tag") || undefined,
    lang: p.get("lang") || undefined,
    unseenMonths: Number(p.get("unseen")) || undefined,
  };
}

export interface FamilyRow extends Family {
  adults: string;
  children: string;
  tags: string;
  last_at: string;
}

/** Search across all fields plus filters. "Not seen in X months" uses the last real interaction. */
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

// One family

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

export async function setNotes(db: DB, familyId: number, notes: string): Promise<void> {
  await db.prepare("UPDATE families SET notes = ? WHERE id = ?").bind(notes, familyId).run();
}

export interface AdultUpdate {
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
  language: string;
}

export async function updateAdult(db: DB, familyId: number, adultId: number, a: AdultUpdate): Promise<void> {
  await db
    .prepare(
      "UPDATE adults SET name = ?, phone = NULLIF(?, ''), email = NULLIF(?, ''), whatsapp = NULLIF(?, ''), language = ? WHERE id = ? AND family_id = ?",
    )
    .bind(a.name, a.phone, a.email, a.whatsapp, a.language || "en", adultId, familyId)
    .run();
}

export async function setOptIn(db: DB, familyId: number, adultId: number, optIn: boolean): Promise<void> {
  await db
    .prepare("UPDATE adults SET broadcast_opt_in = ? WHERE id = ? AND family_id = ?")
    .bind(optIn ? 1 : 0, adultId, familyId)
    .run();
}

export async function addReminder(db: DB, familyId: number, dueOn: string, text: string): Promise<void> {
  await db
    .prepare("INSERT INTO reminders (family_id, due_on, text) VALUES (?, ?, ?)")
    .bind(familyId, dueOn, text)
    .run();
}

export async function completeReminder(db: DB, familyId: number, reminderId: number): Promise<void> {
  await db
    .prepare("UPDATE reminders SET done_at = datetime('now') WHERE id = ? AND family_id = ?")
    .bind(reminderId, familyId)
    .run();
}

// Tags

export async function addTag(db: DB, familyId: number, name: string): Promise<void> {
  const tag = name.trim().slice(0, 40);
  if (!tag) return;
  await db.batch([
    db.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING").bind(tag),
    db
      .prepare("INSERT OR IGNORE INTO family_tags (family_id, tag_id) SELECT ?, id FROM tags WHERE name = ?")
      .bind(familyId, tag),
  ]);
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

// Create and delete

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

/** Manual add for people met without a card, in one transaction. */
export async function createFamily(db: DB, m: ManualFamily): Promise<number> {
  const fam = "(SELECT max(id) FROM families)";
  const stmts = [
    db.prepare("INSERT INTO families (source_page, batch, notes) VALUES ('manual', NULL, ?)").bind(m.notes),
    db
      .prepare(
        `INSERT INTO adults (family_id, name, phone, email, whatsapp, language) VALUES (${fam}, ?, ?, ?, ?, ?)`,
      )
      .bind(m.adultName, m.phone, m.email, m.phone, m.language),
  ];
  if (m.childName) {
    stmts.push(
      db
        .prepare(`INSERT INTO children (family_id, first_name, knows, met_where) VALUES (${fam}, ?, ?, ?)`)
        .bind(m.childName, mergeSet(null, m.knows), m.metWhere),
    );
  }
  stmts.push(
    db.prepare(
      `INSERT INTO interactions (family_id, kind, summary) VALUES (${fam}, 'manual', 'Added manually')`,
    ),
    db.prepare(`SELECT ${fam} AS id`),
  );
  const res = await db.batch<{ id: number }>(stmts);
  return res.at(-1)!.results[0]!.id;
}

/** Deletes a family and everything linked to it. Explicit, so it never depends on foreign key enforcement. */
export async function deleteFamily(db: DB, id: number): Promise<void> {
  await db.batch(
    ["submissions", "family_tags", "reminders", "interactions", "children", "adults"]
      .map((table) => db.prepare(`DELETE FROM ${table} WHERE family_id = ?`).bind(id))
      .concat(db.prepare("DELETE FROM families WHERE id = ?").bind(id)),
  );
}

// Exports

export interface ExportAdult extends Adult {
  source_page: string;
  notes: string;
  children: string | null;
}

export async function adultsOfFamilies(db: DB, familyIds: number[]): Promise<ExportAdult[]> {
  if (!familyIds.length) return [];
  const { results } = await db
    .prepare(
      `SELECT a.*, f.source_page, f.notes,
        (SELECT group_concat(first_name, ', ') FROM children c WHERE c.family_id = a.family_id) AS children
       FROM adults a JOIN families f ON f.id = a.family_id
       WHERE a.family_id IN (${familyIds.map(() => "?").join(",")}) ORDER BY a.name`,
    )
    .bind(...familyIds)
    .all<ExportAdult>();
  return results;
}

/** Everything stored about one family, for a data access request. */
export async function familyDataExport(db: DB, id: number) {
  const data = await getFamily(db, id);
  if (!data) return null;
  const { results: submissions } = await db
    .prepare("SELECT * FROM submissions WHERE family_id = ?")
    .bind(id)
    .all();
  return { ...data, submissions, exported_at: new Date().toISOString() };
}
