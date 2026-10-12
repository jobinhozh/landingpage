import { describe, expect, it } from "vitest";
import { passCookie, readCookie, signPass, verifyPass } from "../src/lib/cookie.ts";
import { toCsv } from "../src/lib/csv.ts";
import { findDuplicateFamily, mergeSet, phoneKey } from "../src/lib/merge.ts";
import { isTokenActive, parseDuration, TOKEN_RE, type TokenRow } from "../src/lib/token.ts";
import { normalizeEmail, normalizePhone, validateContact } from "../src/lib/validation.ts";
import { vcard, whatsappLink } from "../src/lib/vcard.ts";
import { randomToken } from "../src/lib/crypto.ts";

const KEY = "test-signing-key-0123456789";

describe("cookie signing", () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;

  it("round trips a pass for the same page", async () => {
    const v = await signPass(KEY, { page: "kid-one", tokenId: 7, exp });
    expect(await verifyPass(KEY, "kid-one", v)).toEqual({ page: "kid-one", tokenId: 7, exp });
  });
  it("rejects another page, another key, tampering and expiry", async () => {
    const v = await signPass(KEY, { page: "kid-one", tokenId: 7, exp });
    expect(await verifyPass(KEY, "kid-two", v)).toBeNull();
    expect(await verifyPass(`${KEY}x`, "kid-one", v)).toBeNull();
    expect(await verifyPass(KEY, "kid-one", v.replace(/^7\./, "8."))).toBeNull();
    expect(await verifyPass(KEY, "kid-one", v, (exp + 1) * 1000)).toBeNull();
    expect(await verifyPass(KEY, "kid-one", "garbage")).toBeNull();
    expect(await verifyPass(KEY, "kid-one", undefined)).toBeNull();
  });
  it("builds a scoped, hardened cookie and reads it back", () => {
    const c = passCookie("abc", "k1", 60);
    expect(c).toContain("Path=/k1");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(readCookie("a=1; __Secure-pass=abc; b=2", "__Secure-pass")).toBe("abc");
    expect(readCookie(null, "x")).toBeUndefined();
  });
});

describe("token validation", () => {
  const row: TokenRow = {
    id: 1,
    token: "x",
    page: "kid-one",
    batch: "b1",
    expires_at: "2030-01-01 00:00:00",
    revoked_at: null,
  };
  const now = new Date("2026-10-11T00:00:00Z");
  it("accepts active tokens", () => expect(isTokenActive(row, now)).toBe(true));
  it("rejects missing, revoked and expired tokens", () => {
    expect(isTokenActive(null, now)).toBe(false);
    expect(isTokenActive({ ...row, revoked_at: "2026-01-01" }, now)).toBe(false);
    expect(isTokenActive({ ...row, expires_at: "2026-10-10 23:59:59" }, now)).toBe(false);
    expect(isTokenActive({ ...row, expires_at: "nonsense" }, now)).toBe(false);
  });
  it("generates tokens in the expected format", () => {
    expect(randomToken()).toMatch(TOKEN_RE);
    expect(randomToken()).not.toBe(randomToken());
  });
  it("parses durations", () => {
    expect(parseDuration("12m", now).toISOString()).toBe("2027-10-11T00:00:00.000Z");
    expect(parseDuration("1y", now).toISOString()).toBe("2027-10-11T00:00:00.000Z");
    expect(parseDuration("90d", now).toISOString()).toBe("2027-01-09T00:00:00.000Z");
    expect(() => parseDuration("soon")).toThrow();
  });
});

function form(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("form validation", () => {
  it("accepts a complete kid form and normalises contact", () => {
    const r = validateContact(
      form([
        ["name", "  Ana  Muster "],
        ["contact", "079 123 45 67"],
        ["child_name", "Lia"],
        ["times", "weekends"],
        ["times", "bogus"],
        ["consent", "yes"],
      ]),
      "kid-one",
    );
    expect(r.ok).toBe(true);
    expect(r.data.name).toBe("Ana Muster");
    expect(r.data.phone).toBe("+41791234567");
    expect(r.data.email).toBeNull();
    expect(r.data.goodTimes).toEqual(["weekends"]);
  });
  it("requires child name on kid pages only", () => {
    const base: [string, string][] = [
      ["name", "A"],
      ["contact", "a@b.ch"],
      ["consent", "yes"],
    ];
    expect(validateContact(form(base), "kid-two").errors.childName).toBe("error_required");
    expect(validateContact(form(base), "private").ok).toBe(true);
  });
  it("reports missing fields, bad contact and missing consent", () => {
    const r = validateContact(form([["contact", "hello"]]), "private");
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual({ name: "error_required", contact: "error_contact", consent: "error_consent" });
  });
  it("flags the honeypot", () => {
    expect(validateContact(form([["website", "http://spam"]]), "private").bot).toBe(true);
  });
  it("normalises emails and phones", () => {
    expect(normalizeEmail(" Ana@Example.CH ")).toBe("ana@example.ch");
    expect(normalizeEmail("nope@")).toBeNull();
    expect(normalizePhone("+49 151 2345 6789")).toBe("+4915123456789");
    expect(normalizePhone("0041 79 123 45 67")).toBe("+41791234567");
    expect(normalizePhone("12")).toBeNull();
  });
});

describe("duplicate merge", () => {
  const adults = [
    { familyId: 1, email: "ana@example.ch", phone: null },
    { familyId: 2, email: null, phone: "+41791234567" },
  ];
  it("matches by email, case insensitive", () => {
    expect(findDuplicateFamily(adults, { email: "ANA@example.ch", phone: null })).toBe(1);
  });
  it("matches by phone in different notations", () => {
    expect(phoneKey("079 123 45 67")).toBe(phoneKey("+41 79 123 45 67"));
    expect(findDuplicateFamily(adults, { email: null, phone: "0791234567" })).toBe(2);
  });
  it("returns null for new people", () => {
    expect(findDuplicateFamily(adults, { email: "new@example.ch", phone: "+41780000000" })).toBeNull();
  });
  it("merges sets", () => {
    expect(mergeSet("kid-one", ["kid-two", "kid-one"])).toBe("kid-one,kid-two");
    expect(mergeSet(null, ["kid-two"])).toBe("kid-two");
  });
});

describe("exports", () => {
  it("builds a vCard", () => {
    const v = vcard({
      name: "Ana Muster",
      phone: "+41791234567",
      email: "ana@example.ch",
      note: "Met at; park",
    });
    expect(v).toContain("N:Muster;Ana;;;\r\n");
    expect(v).toContain("TEL;TYPE=CELL:+41791234567");
    expect(v).toContain("NOTE:Met at\\; park");
    expect(whatsappLink("+41 79 123 45 67")).toBe("https://wa.me/41791234567");
  });
  it("builds safe CSV", () => {
    const csv = toCsv([{ a: 'x,"y"', b: "=SUM(A1)" }], ["a", "b"]);
    expect(csv).toBe('﻿a,b\r\n"x,""y""",\'=SUM(A1)\r\n');
  });
});

describe("cron schedules", () => {
  it("wrangler.jsonc and the scheduled handler use the same strings, in a form Cloudflare accepts", async () => {
    const { readFileSync } = await import("node:fs");
    const { DAILY, WEEKLY } = await import("../src/lib/cron.ts");
    const raw = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    const crons = JSON.parse(/"crons":\s*(\[[^\]]*\])/.exec(raw)![1]!) as string[];
    expect(crons.sort()).toEqual([DAILY, WEEKLY].sort());
    // Cloudflare: day-of-week is 1-7 or SUN-SAT, 0 is rejected.
    for (const c of crons) expect(c.split(" ")[4]).not.toMatch(/(^|[,-])0($|[,-])/);
  });
});
