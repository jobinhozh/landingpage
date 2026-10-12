/** Short, stable, runtime independent hash of an English source block (FNV-1a, 32 bit). */
export function srcHash(text: string): string {
  let h = 0x811c9dc5;
  const bytes = new TextEncoder().encode(text.trim());
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
