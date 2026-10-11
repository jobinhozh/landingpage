import type { AstroGlobal } from "astro";

/** Reads a POSTed admin form. Astro's checkOrigin already rejects cross-site POSTs. */
export async function adminForm(Astro: AstroGlobal): Promise<FormData | null> {
  if (Astro.request.method !== "POST") return null;
  return Astro.request.formData();
}

export function str(f: FormData, key: string, max = 2000): string {
  const v = f.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function num(f: FormData | URLSearchParams, key: string): number {
  const n = Number(f.get(key));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function fmtDate(sql: string | null | undefined): string {
  return sql ? sql.slice(0, 16).replace("T", " ") : "";
}
