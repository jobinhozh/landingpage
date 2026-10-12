import { describe, expect, it } from "vitest";
import { A4, BLEED, CARD, COLS, grid, QR_MM, ROWS, winAnsi } from "./cards-layout.ts";

describe("card sheet layout", () => {
  const g = grid();
  it("puts 10 cards of 85x55 mm on one A4 sheet", () => {
    expect(g.cells).toHaveLength(10);
    expect(COLS * ROWS).toBe(10);
    expect(CARD).toEqual({ w: 85, h: 55 });
  });
  it("keeps the bleed and room for crop marks inside the page", () => {
    expect(BLEED).toBe(3);
    const margin = 1 + 4; // gap after bleed + mark length
    expect(g.x0 - BLEED - margin).toBeGreaterThanOrEqual(0);
    expect(g.y0 - BLEED - margin).toBeGreaterThanOrEqual(0);
    expect(g.x0 + g.blockW + BLEED + margin).toBeLessThanOrEqual(A4.w);
    expect(g.y0 + g.blockH + BLEED + margin).toBeLessThanOrEqual(A4.h);
  });
  it("butts cards together without overlap", () => {
    const keys = new Set(g.cells.map((c) => `${c.x.toFixed(2)}:${c.y.toFixed(2)}`));
    expect(keys.size).toBe(10);
    for (const c of g.cells) {
      expect(c.x).toBeGreaterThanOrEqual(g.x0);
      expect(c.x + CARD.w).toBeLessThanOrEqual(g.x0 + g.blockW + 1e-9);
    }
  });
  it("prints the QR code at least 20 mm wide", () => {
    expect(QR_MM).toBeGreaterThanOrEqual(20);
    expect(QR_MM).toBeLessThan(CARD.h);
  });
  it("drops characters the PDF font cannot print", () => {
    expect(winAnsi("Grüezi’")).toBe("Grüezi'");
    expect(winAnsi("扫我")).toBe("");
  });
});
