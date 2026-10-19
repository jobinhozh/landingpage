import data from "../data/certifications.json";

/** Filter groups on the business page, in button order. Labels: `certs_filter_<tag>` in content. */
export const certTags = ["sap", "ai", "pm"] as const;
export type CertTag = (typeof certTags)[number];

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
  /** Filter groups this certification belongs to (may be several or none). */
  tags: CertTag[];
}

export const certifications = data as Certification[];

export const certMeta = (c: Certification) => [c.issuer, c.year].filter(Boolean).join(" · ");
