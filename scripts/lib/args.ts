/** Minimal `--flag value` / `--flag` parser. */
export function parseArgs(argv: string[]): { _: string[]; flags: Record<string, string | true> } {
  const _: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    } else _.push(a);
  }
  return { _, flags };
}

export function need(flags: Record<string, string | true>, name: string): string {
  const v = flags[name];
  if (typeof v !== "string" || !v) {
    console.error(`Missing --${name}`);
    process.exit(2);
  }
  return v;
}
