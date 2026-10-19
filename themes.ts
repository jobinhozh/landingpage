import { flagDataUri } from "./flags.ts";

/** Flag colour themes. Applied as CSS custom properties on <html data-theme="…">. */

export interface Theme {
  bg: string;
  /** Halftone dot colour, a slightly lighter or darker shade of bg. */
  dot: string;
  bubble: string;
  accent: string;
  accentText: string;
}

export const themes: Record<string, Theme> = {
  brazil: { bg: "#009C3B", dot: "#00B347", bubble: "#FFDF00", accent: "#002776", accentText: "#FFFFFF" },
  switzerland: { bg: "#DA291C", dot: "#E8493D", bubble: "#FFFFFF", accent: "#111111", accentText: "#FFFFFF" },
  germany: { bg: "#FFCE00", dot: "#F2B800", bubble: "#FFFFFF", accent: "#DD0000", accentText: "#FFFFFF" },
  france: { bg: "#0055A4", dot: "#1968B5", bubble: "#FFFFFF", accent: "#CE2B37", accentText: "#FFFFFF" },
  italy: { bg: "#009246", dot: "#12A556", bubble: "#FFFFFF", accent: "#CE2B37", accentText: "#FFFFFF" },
  uk: { bg: "#012169", dot: "#16357E", bubble: "#FFFFFF", accent: "#C8102E", accentText: "#FFFFFF" },
  spain: { bg: "#AA151B", dot: "#BE2A2F", bubble: "#F1BF00", accent: "#AA151B", accentText: "#FFFFFF" },
  china: { bg: "#EE1C25", dot: "#F43E46", bubble: "#FFFF00", accent: "#B7121A", accentText: "#FFFFFF" },
};

/**
 * Marc's private page: the grown-up comic keeps paper and ink, only accent (buttons, icons, map) and
 * caption (narration box, file card) follow the language's flag. Accents pass WCAG AA with white text.
 */
export interface PrivateTheme {
  accent: string;
  caption: string;
}

export const privateThemes: Record<string, PrivateTheme> = {
  switzerland: { accent: "#D52B1E", caption: "#FADBD8" },
  germany: { accent: "#DD0000", caption: "#FFCE00" },
  uk: { accent: "#C8102E", caption: "#D6E0F5" },
  france: { accent: "#0055A4", caption: "#F9D9DC" },
  brazil: { accent: "#007A33", caption: "#FFDF00" },
  spain: { accent: "#AA151B", caption: "#F1BF00" },
  italy: { accent: "#00843F", caption: "#F2C14E" },
  china: { accent: "#B7121A", caption: "#FFE14D" },
};

export function privateThemeCss(): string {
  return Object.entries(privateThemes)
    .map(([name, t]) => `[data-theme="${name}"]{--p-accent:${t.accent};--p-caption:${t.caption}}`)
    .join("\n");
}

/** CSS for every theme, generated from the table above, plus flag drawings for the country look. */
export function themeCss(): string {
  return Object.entries(themes)
    .map(
      ([name, t]) =>
        `[data-theme="${name}"]{--c-bg:${t.bg};--c-dot:${t.dot};--c-bubble:${t.bubble};--c-accent:${t.accent};--c-accent-text:${t.accentText};--flag-ribbon:${flagDataUri(name, 390, 14)}}`,
    )
    .join("\n");
}
