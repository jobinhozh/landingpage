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
 * Marc's private page: the grown-up comic on the flag's colour. bg + dot = page background with halftone,
 * on = text placed directly on bg (white or ink, whichever passes WCAG AA), accent = buttons, icons and map,
 * caption = narration box and file card. Cards and form stay white with ink outlines.
 */
export interface PrivateTheme {
  bg: string;
  dot: string;
  on: string;
  accent: string;
  caption: string;
}

export const privateThemes: Record<string, PrivateTheme> = {
  switzerland: { bg: "#DA291C", dot: "#E8493D", on: "#FFFFFF", accent: "#D52B1E", caption: "#FFFFFF" },
  germany: { bg: "#FFCE00", dot: "#F2B800", on: "#141414", accent: "#DD0000", caption: "#FFFFFF" },
  uk: { bg: "#012169", dot: "#16357E", on: "#FFFFFF", accent: "#C8102E", caption: "#D6E0F5" },
  france: { bg: "#0055A4", dot: "#1968B5", on: "#FFFFFF", accent: "#CE2B37", caption: "#FFFFFF" },
  brazil: { bg: "#009C3B", dot: "#00B347", on: "#141414", accent: "#002776", caption: "#FFDF00" },
  spain: { bg: "#AA151B", dot: "#BE2A2F", on: "#FFFFFF", accent: "#AA151B", caption: "#F1BF00" },
  italy: { bg: "#009246", dot: "#12A556", on: "#141414", accent: "#CE2B37", caption: "#FFFFFF" },
  china: { bg: "#EE1C25", dot: "#F43E46", on: "#141414", accent: "#B7121A", caption: "#FFFF00" },
};

export function privateThemeCss(): string {
  return Object.entries(privateThemes)
    .map(
      ([name, t]) =>
        `[data-theme="${name}"]{--p-bg:${t.bg};--p-dot:${t.dot};--p-on:${t.on};--p-accent:${t.accent};--p-caption:${t.caption}}`,
    )
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
