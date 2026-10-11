import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { type Adult, type FamilyFilter, getFamily, searchFamilies } from "../../../lib/crm.ts";
import { toCsv } from "../../../lib/csv.ts";
import { notFound } from "../../../lib/http.ts";
import { vcard } from "../../../lib/vcard.ts";

const download = (body: string, type: string, name: string) =>
  new Response(body, {
    headers: { "content-type": type, "content-disposition": `attachment; filename="${name}"` },
  });

function filterFrom(p: URLSearchParams): FamilyFilter {
  return {
    q: p.get("q")?.trim() || undefined,
    page: p.get("page") || undefined,
    tag: p.get("tag") || undefined,
    lang: p.get("lang") || undefined,
    unseenMonths: Number(p.get("unseen")) || undefined,
  };
}

/** Exports: contacts.vcf / contacts.csv (current filter), family-<id>.vcf, family-<id>.json */
export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!locals.admin) return notFound();
  const file = params.file ?? "";
  const db = env.DB;

  if (file === "contacts.vcf" || file === "contacts.csv") {
    const families = await searchFamilies(db, filterFrom(url.searchParams));
    const ids = families.map((f) => f.id);
    if (!ids.length) return download("", "text/plain", file);
    const { results } = await db
      .prepare(
        `SELECT a.*, f.source_page, f.notes,
          (SELECT group_concat(first_name, ', ') FROM children c WHERE c.family_id = a.family_id) AS children
         FROM adults a JOIN families f ON f.id = a.family_id
         WHERE a.family_id IN (${ids.map(() => "?").join(",")}) ORDER BY a.name`,
      )
      .bind(...ids)
      .all<Adult & { source_page: string; notes: string; children: string | null }>();
    if (file === "contacts.vcf") {
      const body = results
        .map((a) =>
          vcard({
            name: a.name,
            phone: a.phone,
            email: a.email,
            note: a.children ? `Kids: ${a.children}` : null,
            categories: [a.source_page],
          }),
        )
        .join("");
      return download(body, "text/vcard; charset=utf-8", file);
    }
    const cols = [
      "family_id",
      "name",
      "phone",
      "email",
      "whatsapp",
      "language",
      "broadcast_opt_in",
      "source_page",
      "children",
      "notes",
    ];
    return download(toCsv(results, cols), "text/csv; charset=utf-8", file);
  }

  const m = /^family-(\d+)\.(vcf|json)$/.exec(file);
  if (!m) return notFound();
  const data = await getFamily(db, Number(m[1]));
  if (!data) return notFound();
  if (m[2] === "json") {
    const { results: submissions } = await db
      .prepare("SELECT * FROM submissions WHERE family_id = ?")
      .bind(data.family.id)
      .all();
    return download(
      JSON.stringify({ ...data, submissions, exported_at: new Date().toISOString() }, null, 2),
      "application/json",
      file,
    );
  }
  const kids = data.children.map((c) => c.first_name).join(", ");
  return download(
    data.adults
      .map((a) =>
        vcard({ name: a.name, phone: a.phone, email: a.email, note: kids ? `Kids: ${kids}` : null }),
      )
      .join(""),
    "text/vcard; charset=utf-8",
    file,
  );
};
