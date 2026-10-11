import type { PersonalPageId } from "../../../../site.config.ts";

export const GOOD_TIMES = ["weekdays", "afternoons", "weekends"] as const;
export type GoodTime = (typeof GOOD_TIMES)[number];

export type FieldError = "error_required" | "error_contact" | "error_consent";

export interface ContactInput {
  name: string;
  contact: string;
  email: string | null;
  phone: string | null;
  childName: string | null;
  metWhere: string | null;
  goodTimes: GoodTime[];
  message: string | null;
  consent: boolean;
}

export interface ValidationOutcome {
  ok: boolean;
  data: ContactInput;
  errors: Partial<Record<keyof ContactInput, FieldError>>;
  /** Honeypot filled → silently accept and drop. */
  bot: boolean;
}

const LIMITS = { name: 80, contact: 120, childName: 40, metWhere: 120, message: 1000 };

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function normalizeEmail(s: string): string | null {
  const v = s.trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

/** Keeps digits and a leading +. Swiss numbers without country code become +41. */
export function normalizePhone(s: string): string | null {
  const raw = s.trim();
  if (!/^[+\d][\d\s()./-]{5,24}$/.test(raw)) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith("0")) digits = `+41${digits.slice(1)}`;
  else if (!digits.startsWith("+")) digits = `+${digits}`;
  const count = digits.replace(/\D/g, "").length;
  return count >= 8 && count <= 15 ? digits : null;
}

function str(form: FormData, key: string, max: number): string {
  const v = form.get(key);
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function text(form: FormData, key: string, max: number): string {
  const v = form.get(key);
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
}

/** Server side validation of the contact form. Private page asks "where we met", kid pages ask child name and times. */
export function validateContact(form: FormData, page: PersonalPageId): ValidationOutcome {
  const isKid = page !== "private";
  const name = str(form, "name", LIMITS.name);
  const contact = str(form, "contact", LIMITS.contact);
  const email = contact.includes("@") ? normalizeEmail(contact) : null;
  const phone = email ? null : normalizePhone(contact);
  const childName = isKid ? str(form, "child_name", LIMITS.childName) : "";
  const metWhere = isKid ? "" : str(form, "met_where", LIMITS.metWhere);
  const goodTimes = isKid
    ? form.getAll("times").filter((t): t is GoodTime => GOOD_TIMES.includes(t as GoodTime))
    : [];
  const message = text(form, "message", LIMITS.message);
  const consent = form.get("consent") === "yes";

  const errors: ValidationOutcome["errors"] = {};
  if (!name) errors.name = "error_required";
  if (!contact) errors.contact = "error_required";
  else if (!email && !phone) errors.contact = "error_contact";
  if (isKid && !childName) errors.childName = "error_required";
  if (!consent) errors.consent = "error_consent";

  return {
    ok: Object.keys(errors).length === 0,
    bot: str(form, "website", 200) !== "",
    errors,
    data: {
      name,
      contact,
      email,
      phone,
      childName: childName || null,
      metWhere: metWhere || null,
      goodTimes: [...new Set(goodTimes)],
      message: message || null,
      consent,
    },
  };
}
