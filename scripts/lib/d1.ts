import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PERSONAL_DIR = fileURLToPath(new URL("../../apps/personal/", import.meta.url));
const DB_NAME = "marc-personal";

/** Escapes a value for an SQL string literal (wrangler d1 execute has no bind parameters). */
export function sql(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

/** Runs SQL through wrangler against the remote D1 (or local with `local: true`). */
export function d1<T = Record<string, unknown>>(command: string, local = false): T[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB_NAME, local ? "--local" : "--remote", "--json", "--command", command],
    { cwd: PERSONAL_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const parsed = JSON.parse(out) as { results: T[] }[];
  return parsed.flatMap((r) => r.results ?? []);
}

export function baseUrl(): string {
  const url = process.env.PERSONAL_BASE_URL;
  if (!url) {
    console.error("Set PERSONAL_BASE_URL (e.g. https://<worker>.<subdomain>.workers.dev) in .env");
    process.exit(2);
  }
  return url.replace(/\/$/, "");
}
