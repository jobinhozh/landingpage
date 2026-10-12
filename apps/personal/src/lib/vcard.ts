export interface VCardInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  categories?: string[];
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

/** vCard 3.0, widest phone support. CRLF line endings as required by RFC 2426. */
export function vcard(v: VCardInput): string {
  const parts = v.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(parts.join(" "))};;;`,
    `FN:${esc(v.name.trim())}`,
  ];
  if (v.phone) lines.push(`TEL;TYPE=CELL:${esc(v.phone)}`);
  if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(v.email)}`);
  if (v.categories?.length) lines.push(`CATEGORIES:${v.categories.map(esc).join(",")}`);
  if (v.note) lines.push(`NOTE:${esc(v.note)}`);
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
