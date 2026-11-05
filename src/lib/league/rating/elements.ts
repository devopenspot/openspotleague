/**
 * Minimum technical elements a run should show, per discipline and format.
 *
 * - Roller comes from Article 9 of Resolución 082/2026 (FCP) and is marked
 *   `reviewed: true`.
 * - Skateboard, BMX and Scooter are drafts adapted from the same structure
 *   and stay `reviewed: false` until the owner signs them off
 *   (`REVIEW_PENDING`). See docs/league.md, "Rating".
 *
 * Elements are a judge checklist. They never change the score: missing
 * elements only lower the scores judges give. Pure: no IO.
 */
import type { RatedFormat, RatingDiscipline } from "./formats";

export interface RequiredElement {
  /** Stable id, stored in `event_scores.elements`. Never rename. */
  id: string;
  label: string;
  min: number;
  max: number;
  /** "Preferably with a grab" style note. */
  preferred?: string;
}

export interface ExampleTrickTier {
  label: string;
  tricks: readonly string[];
}

export interface ElementSet {
  reviewed: boolean;
  source: string;
  elements: readonly RequiredElement[];
  examples: readonly ExampleTrickTier[];
}

const ARTICLE_9 = "Article 9, Resolución 082/2026 (Federación Colombiana de Patinaje)";
const DRAFT = "Draft adapted from Article 9 — pending owner review";

export const REQUIRED_ELEMENTS: Readonly<
  Record<RatingDiscipline, Readonly<Record<RatedFormat, ElementSet>>>
> = {
  roller: {
    park: {
      reviewed: true,
      source: ARTICLE_9,
      elements: [
        { id: "rotation", label: "Flip, transfer or spin (360° or more)", min: 1, max: 1, preferred: "Preferably with a grab" },
        { id: "transfer-air", label: "Transfer or air", min: 1, max: 1, preferred: "Preferably with a grab" },
        { id: "grinds", label: "Grinds", min: 3, max: 5, preferred: "Ideally one switch-up" },
      ],
      examples: [
        { label: "Over 900° or doubles", tricks: ["Double backflip", "1260", "Double misty flip (Kangaroo flip)", "Flatspin 900", "McTwist 900", "Corkscrew 900"] },
        { label: "720°", tricks: ["McTwist 720", "Corkscrew 720", "Misty/bio 720"] },
        { label: "540°", tricks: ["Misty/bio 540", "McTwist 540", "Flatspin 540", "Transition 540"] },
        { label: "Flips", tricks: ["Flatspin 360", "Alley-oop flatspin", "Zero backflip", "Killerflip", "Backflip", "Frontflip"] },
      ],
    },
    street: {
      reviewed: true,
      source: ARTICLE_9,
      elements: [
        { id: "rotation", label: "Flip, transfer or spin (360° or more)", min: 1, max: 1, preferred: "Preferably with a grab" },
        { id: "transfer-air", label: "Transfer or air", min: 1, max: 1, preferred: "Preferably with a grab" },
        { id: "grinds", label: "Grinds", min: 5, max: 8, preferred: "Ideally one switch-up and one unnatural" },
      ],
      examples: [
        { label: "Spin to grind or grind to spin (ideally landing fakie)", tricks: ["450 royal", "540 kindgrind", "450 back full torque", "540 topsoul", "450 front Savannah", "360 topsoul", "Fakie 270 (fullcab) back royal", "270 topsoul", "360 soul", "Fakie 360 (fullcab) to any alley-oop topside (kindgrind, AO fish)"] },
        { label: "Switch-ups (ideally landing fakie)", tricks: ["Inspin torque to TTS", "Backside to back Savannah", "Backslide to alley-oop top acid", "Topsoul to true topside soul", "Top acid to true mizue", "Top soul – 360 – top soul", "Top acid to back Savannah", "Royal to true topside porn"] },
        { label: "Single tricks", tricks: ["Fastslide", "Torque", "Backslide", "270 back backside Savannah", "Alley-oop fishbrain", "Truespin acid", "Top mistrial", "Kindgrind"] },
      ],
    },
    vert: {
      reviewed: true,
      source: ARTICLE_9,
      elements: [
        { id: "walls", label: "Walls, at least to coping height", min: 12, max: 18 },
        { id: "grabbed-airs", label: "Different grabbed airs, at least to coping height", min: 5, max: 5 },
        { id: "spins", label: "Spins (360° or more), at least to coping height", min: 2, max: 3, preferred: "Preferably with a grab" },
        { id: "flip", label: "Flip, at least to coping height", min: 1, max: 1, preferred: "Preferably with a grab" },
        { id: "grinds", label: "Grinds", min: 2, max: 2 },
      ],
      examples: [],
    },
  },
  skateboard: {
    park: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "rotation", label: "Spin or flip trick (360° board or body rotation)", min: 1, max: 1, preferred: "Preferably out of the bowl or on a transfer" },
        { id: "transfer-air", label: "Transfer or air", min: 1, max: 1, preferred: "Preferably with a grab" },
        { id: "grinds", label: "Coping grinds or slides", min: 3, max: 5, preferred: "Ideally one lip trick or invert" },
      ],
      examples: [
        { label: "Big rotations", tricks: ["540", "Kickflip indy", "Frontside 360 air", "Backside 360 air"] },
        { label: "Coping tricks", tricks: ["Frontside smith", "Backside tailslide", "Blunt to fakie", "Frontside invert"] },
      ],
    },
    street: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "rotation", label: "Flip trick or 360° rotation", min: 1, max: 1 },
        { id: "transfer-air", label: "Gap, transfer or air", min: 1, max: 1 },
        { id: "grinds", label: "Grinds or slides on rails and ledges", min: 5, max: 8, preferred: "Ideally one flip-in or flip-out and one switch" },
      ],
      examples: [
        { label: "Flip in or out", tricks: ["Kickflip backside lipslide", "Backside 180 nosegrind", "Nollie heelflip"] },
        { label: "Rail and ledge tricks", tricks: ["Frontside boardslide", "Backside smith", "Crooked grind", "Feeble grind", "Hurricane"] },
      ],
    },
    vert: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "walls", label: "Walls, at least to coping height", min: 12, max: 18 },
        { id: "grabbed-airs", label: "Different grabbed airs above the coping", min: 5, max: 5 },
        { id: "spins", label: "Spins (360° or more)", min: 2, max: 3, preferred: "Preferably with a grab" },
        { id: "flip", label: "Flip trick or invert", min: 1, max: 1 },
        { id: "grinds", label: "Lip tricks or coping grinds", min: 2, max: 2 },
      ],
      examples: [
        { label: "Big airs and rotations", tricks: ["540 McTwist", "720", "Kickflip indy", "Backside 360"] },
      ],
    },
  },
  bmx: {
    park: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "rotation", label: "Spin or flip (360° or more)", min: 1, max: 1, preferred: "Preferably with a bar or tail variation" },
        { id: "transfer-air", label: "Transfer or air", min: 1, max: 1, preferred: "Preferably with a variation (tuck, tabletop, no-hander)" },
        { id: "grinds", label: "Grinds or stalls on coping", min: 3, max: 5, preferred: "Ideally one peg-to-peg switch" },
      ],
      examples: [
        { label: "Flips and big spins", tricks: ["Backflip", "Flair", "540", "Tailwhip air", "360 barspin"] },
      ],
    },
    street: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "rotation", label: "Spin, barspin or tailwhip", min: 1, max: 1 },
        { id: "transfer-air", label: "Gap, transfer or air", min: 1, max: 1 },
        { id: "grinds", label: "Grinds or manuals on rails and ledges", min: 5, max: 8, preferred: "Ideally one spin-in or spin-out and one switch" },
      ],
      examples: [
        { label: "Rail and ledge tricks", tricks: ["Feeble", "Smith", "Icepick", "Hard 180 to feeble", "Double peg"] },
      ],
    },
    vert: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "walls", label: "Walls, at least to coping height", min: 12, max: 18 },
        { id: "grabbed-airs", label: "Different airs or variations above the coping", min: 5, max: 5 },
        { id: "spins", label: "Spins (360° or more)", min: 2, max: 3 },
        { id: "flip", label: "Flip or flair", min: 1, max: 1 },
        { id: "grinds", label: "Lip tricks or coping grinds", min: 2, max: 2 },
      ],
      examples: [
        { label: "Big rotations", tricks: ["Flair", "540", "900", "Backflip tailwhip"] },
      ],
    },
  },
  scooter: {
    park: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "rotation", label: "Spin or flip (360° or more)", min: 1, max: 1, preferred: "Preferably with a bar or deck variation" },
        { id: "transfer-air", label: "Transfer or air", min: 1, max: 1, preferred: "Preferably with a variation" },
        { id: "grinds", label: "Grinds or stalls on coping", min: 3, max: 5, preferred: "Ideally one switch-up" },
      ],
      examples: [
        { label: "Flips and big spins", tricks: ["Backflip", "Flair", "540", "Tailwhip air", "Double whip"] },
      ],
    },
    street: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "rotation", label: "Spin, barspin or tailwhip", min: 1, max: 1 },
        { id: "transfer-air", label: "Gap, transfer or air", min: 1, max: 1 },
        { id: "grinds", label: "Grinds or manuals on rails and ledges", min: 5, max: 8, preferred: "Ideally one spin-in or spin-out and one switch" },
      ],
      examples: [
        { label: "Rail and ledge tricks", tricks: ["Feeble", "Smith", "Crooked", "Board slide", "180 to feeble"] },
      ],
    },
    vert: {
      reviewed: false,
      source: DRAFT,
      elements: [
        { id: "walls", label: "Walls, at least to coping height", min: 12, max: 18 },
        { id: "grabbed-airs", label: "Different airs or variations above the coping", min: 5, max: 5 },
        { id: "spins", label: "Spins (360° or more)", min: 2, max: 3 },
        { id: "flip", label: "Flip or flair", min: 1, max: 1 },
        { id: "grinds", label: "Lip tricks or coping grinds", min: 2, max: 2 },
      ],
      examples: [],
    },
  },
};

export function elementSetFor(discipline: RatingDiscipline, format: RatedFormat): ElementSet {
  return REQUIRED_ELEMENTS[discipline][format];
}

/** Discipline × format pairs whose element lists still need owner sign-off. */
export const REVIEW_PENDING: readonly { discipline: RatingDiscipline; format: RatedFormat }[] =
  (Object.keys(REQUIRED_ELEMENTS) as RatingDiscipline[]).flatMap((discipline) =>
    (Object.keys(REQUIRED_ELEMENTS[discipline]) as RatedFormat[])
      .filter((format) => !REQUIRED_ELEMENTS[discipline][format].reviewed)
      .map((format) => ({ discipline, format })),
  );

/** Ids valid for a division; used to validate judge ticks. */
export function elementIdsFor(discipline: RatingDiscipline, format: RatedFormat): Set<string> {
  return new Set(elementSetFor(discipline, format).elements.map((element) => element.id));
}
