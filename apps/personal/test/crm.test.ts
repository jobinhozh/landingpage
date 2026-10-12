/**
 * CRM against a real local D1 (wrangler's platform proxy, in memory), schema from migrations/.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTag,
  approveSubmission,
  broadcast,
  createFamily,
  deleteFamily,
  getFamily,
  listBatches,
  parseRsvpCode,
  pendingSubmissions,
  recordRsvp,
  rejectSubmission,
  revokeToken,
  rsvpCode,
  rsvpTarget,
  searchFamilies,
  setOptIn,
} from "../src/lib/crm/index.ts";

const TABLES = [
  "family_tags",
  "tags",
  "reminders",
  "interactions",
  "submissions",
  "children",
  "adults",
  "families",
  "tokens",
];
let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let db: D1Database;
let env: Cloudflare.Env;

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
    persist: false,
  });
  db = proxy.env.DB;
  const schema = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.batch(schema.map((s) => db.prepare(s)));
  env = {
    DB: db,
    COOKIE_SIGNING_KEY: "test-key-0123456789abcdef",
    RESEND_FROM: "test@example.com",
  } as unknown as Cloudflare.Env;
});

afterAll(() => proxy.dispose());

beforeEach(async () => {
  vi.unstubAllGlobals();
  await db.batch(TABLES.map((t) => db.prepare(`DELETE FROM ${t}`)));
  env.RESEND_API_KEY = undefined;
});

let seq = 0;
async function submit(fields: Partial<Record<string, string | null>> = {}): Promise<number> {
  const s = {
    page: "kid-one",
    batch: "b1",
    lang: "de",
    name: "Ana Test",
    contact: "ana@example.com",
    email: "ana@example.com",
    phone: null,
    child_name: "Lia",
    met_where: null,
    good_times: "weekends",
    message: null,
    ...fields,
  };
  const row = await db
    .prepare(
      `INSERT INTO submissions (page, batch, lang, name, contact, email, phone, child_name, met_where, good_times, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?)) RETURNING id`,
    )
    .bind(
      s.page,
      s.batch,
      s.lang,
      s.name,
      s.contact,
      s.email,
      s.phone,
      s.child_name,
      s.met_where,
      s.good_times,
      s.message,
      `+${seq++} seconds`,
    )
    .first<{ id: number }>();
  return row!.id;
}

const count = async (table: string) =>
  (await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

describe("approve", () => {
  it("creates a family, adult, child and interaction in one go", async () => {
    const id = await submit();
    const r = await approveSubmission(env, id);
    expect(r).toMatchObject({ merged: false, emailed: false });
    expect(r).toMatchObject({ emailOff: true });
    expect(r!.error).toBeUndefined();
    const f = await getFamily(db, r!.familyId);
    expect(f!.family).toMatchObject({ source_page: "kid-one", batch: "b1" });
    expect(f!.adults).toMatchObject([{ name: "Ana Test", email: "ana@example.com", language: "de" }]);
    expect(f!.children).toMatchObject([{ first_name: "Lia", knows: "kid-one" }]);
    expect(f!.interactions.map((i) => i.kind)).toEqual(["approved"]);
    expect(await pendingSubmissions(db)).toEqual([]);
  });

  it("merges a second contact by email and widens what the child knows", async () => {
    const first = await approveSubmission(env, await submit());
    const second = await approveSubmission(
      env,
      await submit({
        page: "kid-two",
        email: "ANA@example.com",
        contact: "ANA@example.com",
        child_name: "lia",
      }),
    );
    expect(second).toMatchObject({ merged: true, familyId: first!.familyId });
    const f = await getFamily(db, first!.familyId);
    expect(f!.adults).toHaveLength(1);
    expect(f!.children).toMatchObject([{ first_name: "Lia", knows: "kid-one,kid-two" }]);
    expect(await count("families")).toBe(1);
  });

  it("merges by phone in another notation and fills the missing email", async () => {
    const a = await approveSubmission(
      env,
      await submit({ email: null, phone: "+41791234567", contact: "079 123 45 67" }),
    );
    expect(a!.whatsappHello).toMatch(/^https:\/\/wa\.me\/41791234567\?text=/);
    const b = await approveSubmission(
      env,
      await submit({ email: "ana@example.com", phone: "+41791234567", child_name: "Max" }),
    );
    expect(b!.familyId).toBe(a!.familyId);
    const f = await getFamily(db, a!.familyId);
    expect(f!.adults[0]).toMatchObject({ email: "ana@example.com", phone: "+41791234567" });
    expect(f!.children.map((c) => c.first_name)).toEqual(["Lia", "Max"]);
  });

  it("keeps separate people separate", async () => {
    await approveSubmission(env, await submit());
    await approveSubmission(
      env,
      await submit({ email: "ben@example.com", contact: "ben@example.com", name: "Ben" }),
    );
    expect(await count("families")).toBe(2);
  });

  it("approves only once", async () => {
    const id = await submit();
    expect(await approveSubmission(env, id)).not.toBeNull();
    expect(await approveSubmission(env, id)).toBeNull();
    expect(await count("interactions")).toBe(1);
  });

  it("emails the vCard when Resend is configured", async () => {
    env.RESEND_API_KEY = "re_test";
    const calls: { to: string[]; attachments: { filename: string }[] }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    });
    const r = await approveSubmission(env, await submit());
    expect(r).toMatchObject({ emailed: true });
    expect(calls[0]).toMatchObject({ to: ["ana@example.com"], attachments: [{ filename: "contact.vcf" }] });
    const f = await getFamily(db, r!.familyId);
    expect(f!.interactions.map((i) => i.kind).sort()).toEqual(["approved", "email"]);
  });
});

describe("reject", () => {
  it("deletes only pending submissions", async () => {
    const pending = await submit();
    const approved = await submit({ email: "x@example.com", contact: "x@example.com" });
    await approveSubmission(env, approved);
    await rejectSubmission(db, pending);
    await rejectSubmission(db, approved);
    expect(await count("submissions")).toBe(1);
  });
});

describe("families", () => {
  it("creates manually and finds by any field and filter", async () => {
    const id = await createFamily(db, {
      adultName: "Carla",
      email: "carla@example.com",
      phone: null,
      language: "it",
      childName: "Nico",
      knows: ["kid-two"],
      metWhere: "Park",
      notes: "loves trains",
    });
    await addTag(db, id, "neighbours");
    expect((await searchFamilies(db, { q: "nico" })).map((f) => f.id)).toEqual([id]);
    expect((await searchFamilies(db, { q: "trains" })).map((f) => f.id)).toEqual([id]);
    expect((await searchFamilies(db, { page: "kid-two" })).map((f) => f.id)).toEqual([id]);
    expect(await searchFamilies(db, { page: "kid-one" })).toEqual([]);
    expect((await searchFamilies(db, { tag: "neighbours", lang: "it" })).map((f) => f.id)).toEqual([id]);
    expect(await searchFamilies(db, { unseenMonths: 1 })).toEqual([]);
    await db.prepare("UPDATE interactions SET at = datetime('now', '-4 months')").run();
    await db.prepare("UPDATE families SET first_contact_at = datetime('now', '-4 months')").run();
    expect((await searchFamilies(db, { unseenMonths: 3 })).map((f) => f.id)).toEqual([id]);
  });

  it("delete cascades everything", async () => {
    const r = await approveSubmission(env, await submit());
    await addTag(db, r!.familyId, "school");
    await db
      .prepare("INSERT INTO reminders (family_id, due_on, text) VALUES (?, date('now'), 'x')")
      .bind(r!.familyId)
      .run();
    await deleteFamily(db, r!.familyId);
    for (const t of [
      "families",
      "adults",
      "children",
      "interactions",
      "submissions",
      "reminders",
      "family_tags",
    ]) {
      expect(await count(t)).toBe(0);
    }
    expect(await count("tags")).toBe(1);
  });
});

describe("broadcast and RSVP", () => {
  it("sends only to opted-in adults with email and records the RSVP", async () => {
    env.RESEND_API_KEY = "re_test";
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)).text);
      return new Response("{}", { status: 200 });
    });
    const a = await approveSubmission(env, await submit());
    await approveSubmission(
      env,
      await submit({ email: "ben@example.com", contact: "ben@example.com", name: "Ben" }),
    );
    const fam = await getFamily(db, a!.familyId);
    await setOptIn(db, a!.familyId, fam!.adults[0]!.id, true);
    bodies.length = 0;

    const res = await broadcast(env, "https://x.test", {
      page: "kid-one",
      subject: "Party",
      body: "Hi {name}",
      rsvp: true,
    });
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(bodies[0]).toMatch(/^Hi Ana Test/);
    const code = /\/r\/(\S+)$/.exec(bodies[0]!)![1]!;

    const parsed = await parseRsvpCode(env.COOKIE_SIGNING_KEY, code);
    expect(parsed).not.toBeNull();
    expect(await parseRsvpCode(env.COOKIE_SIGNING_KEY, code.replace(/^\d+/, "999"))).toBeNull();
    const target = await rsvpTarget(db, parsed!.interactionId, parsed!.adultId);
    expect(target).toMatchObject({ familyId: a!.familyId, subject: "Party", language: "de" });
    await recordRsvp(db, target!, true);
    const after = await getFamily(db, a!.familyId);
    expect(after!.interactions.map((i) => i.summary)).toContain("yes: Party");
  });

  it("sends nothing and logs nothing while email is off", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const a = await approveSubmission(env, await submit());
    const fam = await getFamily(db, a!.familyId);
    await setOptIn(db, a!.familyId, fam!.adults[0]!.id, true);
    const res = await broadcast(env, "https://x.test", {
      page: "kid-one",
      subject: "Party",
      body: "Hi",
      rsvp: false,
    });
    expect(res).toEqual({ sent: 0, failed: 0, skipped: 0, emailOff: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await getFamily(db, a!.familyId))!.interactions.map((i) => i.kind)).toEqual(["approved"]);
  });

  it("refuses an RSVP for an adult of another family", async () => {
    const a = await approveSubmission(env, await submit());
    const b = await approveSubmission(
      env,
      await submit({ email: "ben@example.com", contact: "ben@example.com", name: "Ben" }),
    );
    const other = (await getFamily(db, b!.familyId))!.adults[0]!.id;
    const interaction = await db
      .prepare(
        "INSERT INTO interactions (family_id, kind, summary) VALUES (?, 'broadcast', 'Party') RETURNING id",
      )
      .bind(a!.familyId)
      .first<{ id: number }>();
    const code = await rsvpCode(env.COOKIE_SIGNING_KEY, interaction!.id, other);
    const parsed = await parseRsvpCode(env.COOKIE_SIGNING_KEY, code);
    expect(await rsvpTarget(db, parsed!.interactionId, parsed!.adultId)).toBeNull();
  });
});

describe("batches", () => {
  it("counts submissions per batch and revokes", async () => {
    await db
      .prepare(
        "INSERT INTO tokens (token, page, batch, expires_at) VALUES ('t1', 'kid-one', 'b1', datetime('now', '+1 year'))",
      )
      .run();
    await submit();
    await approveSubmission(env, await submit({ email: "ben@example.com", contact: "ben@example.com" }));
    const [row] = await listBatches(db);
    expect(row).toMatchObject({ page: "kid-one", batch: "b1", pending: 1, approved: 1, revoked_at: null });
    await revokeToken(db, row!.id);
    expect((await listBatches(db))[0]!.revoked_at).not.toBeNull();
  });
});
