export type MarkerMode = "auto" | "draft";

export interface Marker {
  mode: MarkerMode;
  hash: string;
}

export interface Block {
  text: string;
  /** Present on machine translated blocks. A block without marker is locked. */
  marker?: Marker;
}

export interface PageDoc {
  settings: Record<string, string>;
  /** lang code → key → block */
  langs: Record<string, Record<string, Block>>;
}

export interface ContentDoc {
  /** Text before the first `#` heading, kept verbatim. */
  preamble: string;
  pages: Record<string, PageDoc>;
}

export type Vars = Record<string, string | number>;
