import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  adultsOfFamilies,
  familyDataExport,
  filterFromParams,
  getFamily,
  searchFamilies,
} from "../../../lib/crm/index.ts";
import { toCsv } from "../../../lib/csv.ts";
import { notFound } from "../../../lib/http.ts";
import { vcard } from "../../../lib/vcard.ts";

const download = (body: string, type: string, name: string) =>
  new Response(body, {
    headers: { "content-type": type, "content-disposition": `attachment; filename="${name}"` },
  });

const CSV_COLUMNS = [
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

/** Exports: contacts.vcf / contacts.csv (current filter), family-<id>.vcf, family-<id>.json */
export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!locals.admin) return notFound();
  const file = params.file ?? "";
  const db = env.DB;

  if (file === "contacts.vcf" || file === "contacts.csv") {
    const families = await searchFamilies(db, filterFromParams(url.searchParams));
    const adults = await adultsOfFamilies(
      db,
      families.map((f) => f.id),
    );
    if (file === "contacts.csv") return download(toCsv(adults, CSV_COLUMNS), "text/csv; charset=utf-8", file);
    const body = adults
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

  const m = /^family-(\d+)\.(vcf|json)$/.exec(file);
  if (!m) return notFound();
  const id = Number(m[1]);
  if (m[2] === "json") {
    const data = await familyDataExport(db, id);
    return data ? download(JSON.stringify(data, null, 2), "application/json", file) : notFound();
  }
  const data = await getFamily(db, id);
  if (!data) return notFound();
  const kids = data.children.map((c) => c.first_name).join(", ");
  const body = data.adults
    .map((a) => vcard({ name: a.name, phone: a.phone, email: a.email, note: kids ? `Kids: ${kids}` : null }))
    .join("");
  return download(body, "text/vcard; charset=utf-8", file);
};
