/**
 * npm run translate — fills content.md translations via the Claude API (build time only).
 * English is the only hand-written source. See CLAUDE.md §7 for the marker rules.
 *
 * Env: ANTHROPIC_API_KEY (or an `ant auth login` profile), STRICT_DRAFTS=true, TRANSLATE_DRY_RUN=true
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { parseContent } from "../packages/i18n/src/parse.ts";
import { serializeContent } from "../packages/i18n/src/serialize.ts";
import { contentPages, fallback, languages, tone } from "../site.config.ts";
import { applyJob, type Job, planTranslations, preservesTokens } from "./lib/translate-plan.ts";

const CONTENT = new URL("../content/content.md", import.meta.url);
const LOCKED = new URL("../content/.locked-hashes.json", import.meta.url);
const MODEL = "claude-opus-5-5";

const Result = z.object({
  translations: z.array(z.object({ key: z.string(), text: z.string() })),
});

async function translate(client: Anthropic, job: Job): Promise<Record<string, string>> {
  const lang = languages.find((l) => l.code === job.lang)!;
  const pageTone = tone[contentPages[job.page as keyof typeof contentPages]?.tone ?? "private"];
  const swiss =
    job.lang === "gsw"
      ? " Write Swiss German (Zürich dialect, Schwiizerdütsch) as it is commonly written in messages, not Standard German. Swiss spelling, no ß."
      : "";
  const formal = job.lang === "de" && job.page === "business" ? " Use the formal Sie." : "";
  const system = [
    `You translate website copy from English into ${lang.label} (${lang.code}).`,
    `Tone: ${pageTone}.${swiss}${formal}`,
    "Keep Markdown (**bold**, *italic*, [links](url), `- ` list lines, line breaks) and every {placeholder} exactly as in the source. Do not translate placeholder names or URLs.",
    "Text in [square brackets] is a placeholder the owner will replace: translate the words inside but keep the brackets.",
    "Keep proper names, brand names and product names (SAP, S/4HANA, Cloud ALM, WhatsApp, Cal.com, Cloudflare) unchanged.",
    "Return one entry per input key, with the same key.",
  ].join("\n");
  const input = Object.entries(job.items).map(([key, text]) => ({ key, text }));

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Result) },
    system,
    messages: [{ role: "user", content: `Page: ${job.page}\n\n${JSON.stringify(input, null, 2)}` }],
  });
  if (response.stop_reason === "refusal")
    throw new Error(`refused: ${response.stop_details?.category ?? "unknown"}`);
  if (response.stop_reason === "max_tokens") throw new Error("output truncated (max_tokens)");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("no structured output");

  const out: Record<string, string> = {};
  for (const { key, text } of parsed.translations) {
    const src = job.items[key];
    if (src === undefined) continue;
    if (!preservesTokens(src, text)) {
      console.warn(`  ! ${job.page}/${job.lang}/${key}: placeholders or links changed, skipped`);
      continue;
    }
    out[key] = text;
  }
  return out;
}

async function main() {
  const raw = readFileSync(CONTENT, "utf8");
  const doc = parseContent(raw);
  const previous: Record<string, string> = existsSync(LOCKED) ? JSON.parse(readFileSync(LOCKED, "utf8")) : {};
  const plan = planTranslations(doc, languages, previous);
  const total = plan.jobs.reduce((n, j) => n + Object.keys(j.items).length, 0);
  console.log(`translate: ${total} blocks in ${plan.jobs.length} page/language jobs`);

  let translated = 0;
  let failed = 0;
  if (total && process.env.TRANSLATE_DRY_RUN !== "true") {
    const client = new Anthropic();
    for (const job of plan.jobs) {
      try {
        const n = applyJob(doc, job, await translate(client, job));
        translated += n;
        failed += Object.keys(job.items).length - n;
        console.log(`  ${job.page}/${job.lang}: ${n}/${Object.keys(job.items).length}`);
      } catch (e) {
        failed += Object.keys(job.items).length;
        const msg = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : String(e);
        console.error(`  ✗ ${job.page}/${job.lang}: ${msg}`);
      }
    }
  }

  const next = serializeContent(
    doc,
    languages.map((l) => l.code),
    fallback,
  );
  if (next !== raw) writeFileSync(CONTENT, next);
  const lockedJson = `${JSON.stringify(Object.fromEntries(Object.entries(plan.lockedHashes).sort()), null, 2)}\n`;
  if (!existsSync(LOCKED) || readFileSync(LOCKED, "utf8") !== lockedJson) writeFileSync(LOCKED, lockedJson);

  const drafts =
    plan.draftsRemaining.length +
    plan.jobs.filter((j) => j.mode === "draft").reduce((n, j) => n + Object.keys(j.items).length, 0);
  console.log("\nReport");
  console.log(`  translated:              ${translated}`);
  console.log(`  failed or skipped:       ${failed}`);
  console.log(`  drafts to review (gsw):  ${drafts}`);
  console.log(`  locked with stale source: ${plan.staleLocked.length}`);
  for (const s of plan.staleLocked)
    console.log(`    - ${s} (update it, then delete its line in content/.locked-hashes.json)`);

  if (failed) process.exitCode = 1;
  if (process.env.STRICT_DRAFTS === "true" && drafts > 0) {
    console.error(`STRICT_DRAFTS: ${drafts} Swiss German drafts still carry a draft marker`);
    process.exitCode = 1;
  }
}

await main();
