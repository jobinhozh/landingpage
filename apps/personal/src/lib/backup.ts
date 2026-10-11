/** D1 → SQL text dump (schema + INSERTs), restorable with `wrangler d1 execute --file`. */

function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof ArrayBuffer)
    return `X'${[...new Uint8Array(v)].map((b) => b.toString(16).padStart(2, "0")).join("")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export async function dumpDatabase(db: D1Database): Promise<string> {
  const { results: tables } = await db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY rowid",
    )
    .all<{ name: string; sql: string }>();
  const { results: indexes } = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL")
    .all<{ sql: string }>();

  const out = [`-- D1 backup ${new Date().toISOString()}`, "PRAGMA foreign_keys = OFF;"];
  for (const t of tables) {
    out.push(`DROP TABLE IF EXISTS "${t.name}";`, `${t.sql};`);
    const { results: rows } = await db.prepare(`SELECT * FROM "${t.name}"`).all<Record<string, unknown>>();
    for (const r of rows) {
      const cols = Object.keys(r);
      out.push(
        `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((c) => literal(r[c])).join(", ")});`,
      );
    }
  }
  for (const i of indexes) out.push(`${i.sql};`);
  out.push("PRAGMA foreign_keys = ON;");
  return `${out.join("\n")}\n`;
}

export const BACKUP_PREFIX = "backups/";
export const KEEP_BACKUPS = 12;

export async function backupToR2(db: D1Database, bucket: R2Bucket): Promise<string> {
  const key = `${BACKUP_PREFIX}d1-${new Date().toISOString().slice(0, 10)}.sql`;
  await bucket.put(key, await dumpDatabase(db), { httpMetadata: { contentType: "application/sql" } });
  const listed = await bucket.list({ prefix: BACKUP_PREFIX });
  const old = listed.objects
    .map((o) => o.key)
    .sort()
    .reverse()
    .slice(KEEP_BACKUPS);
  if (old.length) await bucket.delete(old);
  return key;
}
