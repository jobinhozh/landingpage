import { backupToR2 } from "./backup.ts";
import { push } from "./notify.ts";

export const DAILY = "45 5 * * *";
// Cloudflare rejects 0 for Sunday, it accepts 1-7 or SUN-SAT. Must match wrangler.jsonc exactly.
export const WEEKLY = "15 2 * * SUN";

export async function runScheduled(cron: string, env: Cloudflare.Env): Promise<void> {
  if (cron === WEEKLY) {
    const key = await backupToR2(env.DB, env.BUCKET);
    console.log(`[backup] ${key}`);
    return;
  }
  await daily(env);
}

/** Deletes unapproved submissions older than 90 days and pushes due reminders. */
export async function daily(env: Cloudflare.Env): Promise<void> {
  const del = await env.DB.prepare(
    "DELETE FROM submissions WHERE status = 'pending' AND created_at < datetime('now', '-90 days')",
  ).run();
  console.log(`[cleanup] deleted ${del.meta.changes ?? 0} old submissions`);

  const { results } = await env.DB.prepare(
    "SELECT id, family_id, text FROM reminders WHERE done_at IS NULL AND notified_at IS NULL AND due_on <= date('now')",
  ).all<{ id: number; family_id: number; text: string }>();
  for (const r of results) {
    // The push text is written by Marc in the admin; keep it free of personal details.
    await push(env, "Reminder", r.text);
    await env.DB.prepare("UPDATE reminders SET notified_at = datetime('now') WHERE id = ?").bind(r.id).run();
  }
}
