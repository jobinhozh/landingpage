/**
 * Simple geometric flag drawings per theme, rendered as SVG at any size.
 * Used for the kid pages' country look: flag ribbon, form strip and the flag language buttons.
 */

type Builder = (w: number, h: number) => string;

const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

/** Bands left to right, weights relative. */
const vertical =
  (colors: string[], weights = colors.map(() => 1)): Builder =>
  (w, h) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let x = 0;
    return colors
      .map((c, i) => {
        const bw = (w * weights[i]!) / total;
        const r = rect(x, 0, bw + 0.5, h, c);
        x += bw;
        return r;
      })
      .join("");
  };

/** Bands top to bottom, weights relative. */
const horizontal =
  (colors: string[], weights = colors.map(() => 1)): Builder =>
  (w, h) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let y = 0;
    return colors
      .map((c, i) => {
        const bh = (h * weights[i]!) / total;
        const r = rect(0, y, w, bh + 0.5, c);
        y += bh;
        return r;
      })
      .join("");
  };

function star(cx: number, cy: number, r: number, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = ((rot + i * 36) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * 0.382;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(2)},${(cy + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="#FFDE00"/>`;
}

const builders: Record<string, Builder> = {
  switzerland: (w, h) => {
    const m = Math.min(w, h);
    const t = m * 0.2;
    const l = m * 0.62;
    const cx = w / 2;
    const cy = h / 2;
    return (
      rect(0, 0, w, h, "#DA291C") +
      rect(cx - t / 2, cy - l / 2, t, l, "#FFFFFF") +
      rect(cx - l / 2, cy - t / 2, l, t, "#FFFFFF")
    );
  },
  germany: horizontal(["#000000", "#DD0000", "#FFCE00"]),
  france: vertical(["#0055A4", "#FFFFFF", "#EF4135"]),
  italy: vertical(["#009246", "#FFFFFF", "#CE2B37"]),
  spain: horizontal(["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1]),
  uk: (w, h) => {
    const m = Math.min(w, h);
    const diagW = m * 0.2;
    const diagR = m * 0.07;
    const crossW = m * 0.33;
    const crossR = m * 0.2;
    const line = (x1: number, y1: number, x2: number, y2: number, c: string, sw: number) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}"/>`;
    return (
      rect(0, 0, w, h, "#012169") +
      line(0, 0, w, h, "#FFFFFF", diagW) +
      line(w, 0, 0, h, "#FFFFFF", diagW) +
      line(0, 0, w, h, "#C8102E", diagR) +
      line(w, 0, 0, h, "#C8102E", diagR) +
      rect((w - crossW) / 2, 0, crossW, h, "#FFFFFF") +
      rect(0, (h - crossW) / 2, w, crossW, "#FFFFFF") +
      rect((w - crossR) / 2, 0, crossR, h, "#C8102E") +
      rect(0, (h - crossR) / 2, w, crossR, "#C8102E")
    );
  },
  brazil: (w, h) => {
    const ix = w * 0.085;
    const iy = h * 0.085;
    const r = Math.min(w - 2 * ix, h - 2 * iy) * 0.3;
    const cx = w / 2;
    const cy = h / 2;
    return (
      rect(0, 0, w, h, "#009C3B") +
      `<polygon points="${ix},${cy} ${cx},${iy} ${w - ix},${cy} ${cx},${h - iy}" fill="#FFDF00"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#002776"/>` +
      `<path d="M${cx - r * 0.98},${cy + r * 0.05} Q${cx},${cy - r * 0.45} ${cx + r * 0.95},${cy + r * 0.32}" stroke="#FFFFFF" stroke-width="${r * 0.16}" fill="none"/>`
    );
  },
  china: (w, h) => {
    // Classic 30x20 grid, anchored top-left; extra space keeps the red field.
    const u = Math.min(w / 30, h / 20);
    const ox = 0;
    const oy = 0;
    return (
      rect(0, 0, w, h, "#EE1C25") +
      star(ox + 5 * u, oy + 5 * u, 3 * u) +
      star(ox + 10 * u, oy + 2 * u, u, -54) +
      star(ox + 12 * u, oy + 4 * u, u, -72) +
      star(ox + 12 * u, oy + 7 * u, u, -90) +
      star(ox + 10 * u, oy + 9 * u, u, -108)
    );
  },
};

export function flagSvg(theme: string, w: number, h: number, attrs = ""): string {
  const build = builders[theme] ?? builders.uk!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" ${attrs}>${build(w, h)}</svg>`;
}

export function flagDataUri(theme: string, w: number, h: number): string {
  return `url("data:image/svg+xml,${encodeURIComponent(flagSvg(theme, w, h))}")`;
}

export const flagThemes = Object.keys(builders);
