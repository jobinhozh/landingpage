/** Duplicate detection for approving submissions into the CRM. */

export interface AdultKey {
  familyId: number;
  email: string | null;
  phone: string | null;
}

export interface Incoming {
  email: string | null;
  phone: string | null;
}

/** Last 9 digits, so +41 79 123 45 67 and 079 123 45 67 match. */
export function phoneKey(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : null;
}

/**
 * Returns the family to merge into: the first adult with the same email (case insensitive)
 * or the same phone number. Email matches win over phone matches.
 */
export function findDuplicateFamily(adults: AdultKey[], incoming: Incoming): number | null {
  const email = incoming.email?.trim().toLowerCase() || null;
  if (email) {
    const hit = adults.find((a) => a.email?.trim().toLowerCase() === email);
    if (hit) return hit.familyId;
  }
  const pk = phoneKey(incoming.phone);
  if (pk) {
    const hit = adults.find((a) => phoneKey(a.phone) === pk);
    if (hit) return hit.familyId;
  }
  return null;
}

/** Merges a comma separated set, e.g. which kids a child knows. */
export function mergeSet(existing: string | null, add: string[]): string {
  const set = new Set(
    (existing ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const a of add) if (a) set.add(a);
  return [...set].sort().join(",");
}
