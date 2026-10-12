/** Card sheet geometry and PDF drawing primitives. Units are millimetres unless noted. */
import { type PDFFont, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";

export const MM = 72 / 25.4;
export const A4 = { w: 210, h: 297 };
export const CARD = { w: 85, h: 55 };
export const BLEED = 3;
export const COLS = 2;
export const ROWS = 5;
export const QR_MM = 24;

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

export const hex = (h: string) =>
  rgb(
    Number.parseInt(h.slice(1, 3), 16) / 255,
    Number.parseInt(h.slice(3, 5), 16) / 255,
    Number.parseInt(h.slice(5, 7), 16) / 255,
  );
export const BLACK = hex("#111111");
export const WHITE = rgb(1, 1, 1);

/** Standard PDF fonts are WinAnsi only. */
export function winAnsi(s: string): string {
  const out = s.replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF–—…]/g, "");
  if (out !== s) console.warn(`  ! text "${s}" contains characters the card font cannot print`);
  return out;
}

export function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = QR_QUIET_MODULES;
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

export function text(
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

export function cropMarks(page: PDFPage, g: ReturnType<typeof grid>) {
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

/** Quiet zone around the QR code, in modules (ISO 18004 asks for 4). */
export const QR_QUIET_MODULES = 4;
