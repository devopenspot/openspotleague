export type LegalCalloutType = "risk" | "trespass";

/** One section of a legal page: a short summary plus a few plain bullets. */
export interface LegalSection {
  id: string;
  number: string;
  title: string;
  summary: string;
  points: readonly string[];
  calloutType?: LegalCalloutType;
}
