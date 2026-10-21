import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import { stripMarkdown } from "@marc/i18n";
import { t } from "@marc/i18n/content";
import { certMeta, certifications } from "./certifications.ts";
import { PAGE } from "./i18n.ts";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.078, 0.078, 0.078);
const ACCENT = rgb(0.72, 0.196, 0.102);
const MUTED = rgb(0.34, 0.325, 0.3);

/** pdf-lib standard fonts are WinAnsi only. Replace what they cannot encode. */
function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\n–—•·…€]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** One page CV, rendered from content.md (`cv_*` keys of the business page). */
export async function renderCv(lang: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const p = (k: string) => safe(stripMarkdown(t(PAGE, k, lang)));
  pdf.setTitle(p("cv_title"));
  pdf.setLanguage(lang);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(A4);
  const width = A4[0] - MARGIN * 2;
  let y = A4[1] - MARGIN;

  const ensure = (h: number) => {
    if (y - h < MARGIN) {
      page = pdf.addPage(A4);
      y = A4[1] - MARGIN;
    }
  };
  const text = (s: string, font: PDFFont, size: number, color = INK, indent = 0) => {
    for (const line of wrap(s, font, size, width - indent)) {
      ensure(size * 1.4);
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color });
      y -= size * 1.45;
    }
  };
  const section = (titleKey: string, bodyKey: string) => {
    y -= 14;
    text(p(titleKey).toUpperCase(), bold, 10, ACCENT);
    y -= 2;
    const body = p(bodyKey);
    const lines = body.split("\n");
    if (lines.every((l) => l.startsWith("- "))) {
      for (const l of lines) {
        ensure(15);
        page.drawText("•", { x: MARGIN, y: y - 10.5, size: 10.5, font: regular, color: INK });
        text(l.slice(2), regular, 10.5, INK, 12);
      }
    } else text(body, regular, 10.5);
  };

  text(p("cv_title"), bold, 24);
  text(p("cv_subtitle"), regular, 12, MUTED);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.75, color: ACCENT });
  y -= 6;
  section("cv_profile_title", "cv_profile");
  section("cv_experience_title", "cv_experience");
  section("cv_skills_title", "cv_skills");
  if (certifications.length) {
    y -= 14;
    text(p("certs_title").toUpperCase(), bold, 10, ACCENT);
    y -= 2;
    for (const c of certifications) {
      ensure(15);
      page.drawText("•", { x: MARGIN, y: y - 10.5, size: 10.5, font: regular, color: INK });
      text(safe(`${c.name} (${certMeta(c)})`), regular, 10.5, INK, 12);
    }
  }
  section("cv_languages_title", "cv_languages");
  return pdf.save();
}
