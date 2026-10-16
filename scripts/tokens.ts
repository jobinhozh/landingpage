/**
 * QR tokens. One token per page per print batch.
 *   npm run token:create -- --page kid-one --batch 2026-autumn [--expires 12m] [--reuse] [--local]
 *     --reuse: keep the active token of that page and batch if there is one (for repeat runs)
 *   npm run token:revoke -- --page kid-one --batch 2026-autumn [--local]
 *   npm run token:list [-- --local]
 */
import { randomToken } from "../apps/personal/src/lib/crypto.ts";
import { parseDuration, toSqlDate } from "../apps/personal/src/lib/token.ts";
import { personalPages, tokenDefaults } from "../site.config.ts";
import { need, parseArgs } from "./lib/args.ts";
import { baseUrl, d1, sql } from "./lib/d1.ts";

const { _, flags } = parseArgs(process.argv.slice(2));
const local = flags.local === true;
const cmd = _[0];

function page(): string {
  const p = need(flags, "page");
  if (!personalPages.some((x) => x.id === p)) {
    console.error(`Unknown page "${p}". Use one of: ${personalPages.map((x) => x.id).join(", ")}`);
    process.exit(2);
  }
  return p;
}

function batch(): string {
  const b = need(flags, "batch");
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(b)) {
    console.error("Batch labels use letters, digits, dot, dash or underscore (max 40)");
    process.exit(2);
  }
  return b;
}

if (cmd === "create") {
  const p = page();
  const b = batch();
  const expires = parseDuration(
    typeof flags.expires === "string" ? flags.expires : `${tokenDefaults.expiryMonths}m`,
  );
  if (flags.reuse === true) {
    const [old] = d1<{ token: string }>(
      `SELECT token FROM tokens WHERE page = ${sql(p)} AND batch = ${sql(b)} AND revoked_at IS NULL AND expires_at > datetime('now') LIMIT 1`,
      local,
    );
    if (old) {
      if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${old.token}`);
      console.log(`Kept the active token of ${p} / ${b}`);
      process.exit(0);
    }
  }
  const token = randomToken();
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${token}`);
  d1(
    `INSERT INTO tokens (token, page, batch, expires_at) VALUES (${sql(token)}, ${sql(p)}, ${sql(b)}, ${sql(toSqlDate(expires))})`,
    local,
  );
  console.log(`Created ${p} / ${b}, expires ${toSqlDate(expires)} UTC`);
  console.log(`${baseUrl()}/s/${token}`);
  console.log(`Next: npm run cards:pdf -- --batch ${b} --page ${p}`);
} else if (cmd === "revoke") {
  const p = page();
  const b = batch();
  d1(
    `UPDATE tokens SET revoked_at = datetime('now') WHERE page = ${sql(p)} AND batch = ${sql(b)} AND revoked_at IS NULL`,
    local,
  );
  console.log(`Revoked ${p} / ${b}. Cards of this batch now show a 404.`);
} else if (cmd === "list") {
  const rows = d1(
    "SELECT page, batch, scans, created_at, expires_at, revoked_at, (SELECT count(*) FROM submissions s WHERE s.page = t.page AND s.batch = t.batch) AS submissions FROM tokens t ORDER BY created_at DESC",
    local,
  );
  console.table(rows);
} else {
  console.error("Usage: tokens.ts create|revoke|list");
  process.exit(2);
}
