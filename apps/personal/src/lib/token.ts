export interface TokenRow {
  id: number;
  token: string;
  page: string;
  batch: string;
  expires_at: string;
  revoked_at: string | null;
}

/** Token format produced by scripts/tokens.ts: 22 base64url characters. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

/** Expiry in ms. D1 stores `YYYY-MM-DD HH:MM:SS` in UTC. */
export function tokenExpiry(row: Pick<TokenRow, "expires_at">): number {
  const v = row.expires_at;
  return Date.parse(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
}

/** A token is usable when it exists, is not revoked and has not expired. */
export function isTokenActive(row: TokenRow | null | undefined, now = new Date()): row is TokenRow {
  if (!row) return false;
  if (row.revoked_at) return false;
  const exp = tokenExpiry(row);
  return Number.isFinite(exp) && exp > now.getTime();
}

export function toSqlDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Parses `12m`, `6m`, `1y`, `90d`. */
export function parseDuration(s: string, from = new Date()): Date {
  const m = /^(\d+)([dmy])$/.exec(s.trim());
  if (!m) throw new Error(`Invalid duration "${s}", use e.g. 12m, 1y or 90d`);
  const n = Number(m[1]);
  if (m[2] === "d") return new Date(from.getTime() + n * 86_400_000);
  return addMonths(from, m[2] === "y" ? n * 12 : n);
}
