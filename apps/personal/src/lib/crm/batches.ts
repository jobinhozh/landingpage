import type { DB } from "./types.ts";

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
