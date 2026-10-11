/**
 * Printable QR cards: A4, 10 cards (2×5) of 85×55 mm, 3 mm bleed, crop marks.
 *   npm run cards:pdf -- --batch 2026-autumn [--page kid-one] [--local]
 * Writes cards/<batch>-<page>.pdf (gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { createTranslator } from "../packages/i18n/src/translator.ts";
import { parseContent } from "../packages/i18n/src/parse.ts";
import { languages, personalPages } from "../site.config.ts";
import { themes } from "../themes.ts";
import { need, parseArgs } from "./lib/args.ts";
import { baseUrl, d1, sql } from "./lib/d1.ts";

const MM = 72 / 25.4;
const A4 = { w: 210, h: 297 };
const CARD = { w: 85, h: 55 };
const BLEED = 3;
const COLS = 2;
const ROWS = 5;
const QR_MM = 24;

/** Card positions (mm, origin bottom left), cards butt against each other so cut lines are shared. */
export function grid() {
  const blockW = COLS * CARD.w;
  const blockH = ROWS * CARD.h;
  const x0 = (A4.w - blockW) / 2;
  const y0 = (A4.h - blockH) / 2;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) cells.push({ x: x0 + c * CARD.w, y: y0 + (ROWS - 1 - r) * CARD.h });
  return { x0, y0, blockW, blockH, cells };
}

const hex = (h: string) =>
  rgb(
    Number.parseInt(h.slice(1, 3), 16) / 255,
    Number.parseInt(h.slice(3, 5), 16) / 255,
    Number.parseInt(h.slice(5, 7), 16) / 255,
  );
const BLACK = hex("#111111");
const WHITE = rgb(1, 1, 1);

/** Standard PDF fonts are WinAnsi only. */
function winAnsi(s: string): string {
  const out = s.replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF–—…]/g, "");
  if (out !== s) console.warn(`  ! text "${s}" contains characters the card font cannot print`);
  return out;
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 4;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x: x * MM, y: y * MM, width: size * MM, height: size * MM, color: WHITE });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      page.drawRectangle({
        x: (x + (c + quiet) * cell) * MM,
        y: (y + size - (r + quiet + 1) * cell) * MM,
        width: cell * MM + 0.05,
        height: cell * MM + 0.05,
        color: BLACK,
      });
    }
  }
}

function text(
  page: PDFPage,
  s: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  color = BLACK,
  maxW?: number,
) {
  let sz = size;
  const t = winAnsi(s);
  while (maxW && font.widthOfTextAtSize(t, sz) > maxW * MM && sz > 5) sz -= 0.5;
  page.drawText(t, { x: x * MM, y: y * MM, size: sz, font, color });
}

function cropMarks(page: PDFPage, g: ReturnType<typeof grid>) {
  const gap = BLEED + 1;
  const len = 4;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({
      start: { x: x1 * MM, y: y1 * MM },
      end: { x: x2 * MM, y: y2 * MM },
      thickness: 0.3,
      color: BLACK,
    });
  for (let c = 0; c <= COLS; c++) {
    const x = g.x0 + c * CARD.w;
    line(x, g.y0 - gap, x, g.y0 - gap - len);
    line(x, g.y0 + g.blockH + gap, x, g.y0 + g.blockH + gap + len);
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = g.y0 + r * CARD.h;
    line(g.x0 - gap, y, g.x0 - gap - len, y);
    line(g.x0 + g.blockW + gap, y, g.x0 + g.blockW + gap + len, y);
  }
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const batch = need(flags, "batch");
  const only = typeof flags.page === "string" ? flags.page : undefined;
  const rows = d1<{ page: string; token: string }>(
    `SELECT page, token FROM tokens WHERE batch = ${sql(batch)} AND revoked_at IS NULL AND expires_at > datetime('now')${only ? ` AND page = ${sql(only)}` : ""}`,
    flags.local === true,
  );
  if (!rows.length) {
    console.error(`No active tokens for batch "${batch}". Create one with npm run token:create.`);
    process.exit(1);
  }
  const { t, setting } = createTranslator(
    parseContent(readFileSync(new URL("../content/content.md", import.meta.url), "utf8")),
  );
  const base = baseUrl();
  mkdirSync(new URL("../cards/", import.meta.url), { recursive: true });

  for (const row of rows) {
    const page = personalPages.find((p) => p.id === row.page);
    if (!page) continue;
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Cards ${page.id} ${batch}`);
    const bold = await pdf.embedFont(
      page.style === "comic" ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold,
    );
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const sheet = pdf.addPage([A4.w * MM, A4.h * MM]);
    const g = grid();
    const url = `${base}/s/${row.token}`;
    const [mainLang, ...otherLangs] = page.cardLanguages;
    const theme = themes[languages.find((l) => l.code === mainLang)?.theme ?? "switzerland"]!;
    const bg = page.style === "comic" ? hex(theme.bg) : hex("#EEF1EF");
    const ink = page.style === "comic" ? WHITE : hex("#16222B");

    // Background including bleed, then each card's content.
    sheet.drawRectangle({
      x: (g.x0 - BLEED) * MM,
      y: (g.y0 - BLEED) * MM,
      width: (g.blockW + 2 * BLEED) * MM,
      height: (g.blockH + 2 * BLEED) * MM,
      color: bg,
    });
    if (page.style === "comic") {
      for (let x = g.x0 - BLEED; x <= g.x0 + g.blockW + BLEED; x += 3) {
        for (let y = g.y0 - BLEED; y <= g.y0 + g.blockH + BLEED; y += 3) {
          sheet.drawCircle({ x: x * MM, y: y * MM, size: 0.45 * MM, color: hex(theme.dot) });
        }
      }
    }
    for (const { x, y } of g.cells) {
      const qrX = x + CARD.w - QR_MM - 5;
      const qrY = y + (CARD.h - QR_MM) / 2;
      if (page.style === "comic") {
        sheet.drawRectangle({
          x: (qrX - 1.2) * MM,
          y: (qrY - 1.2) * MM,
          width: (QR_MM + 2.4) * MM,
          height: (QR_MM + 2.4) * MM,
          color: BLACK,
        });
      }
      drawQr(sheet, url, qrX, qrY, QR_MM);
      const textW = CARD.w - QR_MM - 14;
      const title = page.style === "comic" ? setting(page.id, "hero_name") : t(page.id, "title", mainLang!);
      text(sheet, title, bold, 17, x + 6, y + CARD.h - 15, ink, textW);
      if (page.style === "comic")
        text(sheet, t(page.id, "card_line", mainLang!), bold, 9.5, x + 6, y + CARD.h - 23, ink, textW);
      let ty = y + 14;
      const seen = new Set<string>();
      for (const lang of [mainLang!, ...otherLangs]) {
        const line = t(page.id, "card_scan", lang);
        if (seen.has(line)) continue;
        seen.add(line);
        text(
          sheet,
          line,
          lang === mainLang ? bold : regular,
          lang === mainLang ? 11 : 8.5,
          x + 6,
          ty,
          ink,
          textW,
        );
        ty -= 5;
      }
    }
    cropMarks(sheet, g);
    const file = new URL(`../cards/${batch}-${page.id}.pdf`, import.meta.url);
    writeFileSync(file, await pdf.save());
    console.log(`Wrote cards/${batch}-${page.id}.pdf (${url})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
