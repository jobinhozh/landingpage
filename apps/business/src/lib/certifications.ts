import data from "../data/certifications.json";

/**
 * Certifications, shown on the business page and in the CV. Names are proper names and stay
 * untranslated, so they live here instead of content.md. Order = display order.
 */
export interface Certification {
  name: string;
  issuer: string;
  year?: string;
  /** Optional link to the credential (e.g. Credly). */
  url?: string;
}

export const certifications: Certification[] = data;

export const certMeta = (c: Certification) => [c.issuer, c.year].filter(Boolean).join(" · ");
