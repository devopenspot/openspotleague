/**
 * The five World Skate judging criteria named in Article 9, with per-format
 * guidance condensed from the article. Shown to judges (scoring form) and
 * riders (format brief). Pure: no IO.
 */
import type { RatedFormat } from "./formats";

export const RATING_CRITERIA_KEYS = [
  "difficulty",
  "style",
  "amplitude",
  "consistency",
  "creativity",
] as const;
export type RatingCriterionKey = (typeof RATING_CRITERIA_KEYS)[number];

export interface RatingCriterion {
  key: RatingCriterionKey;
  label: string;
  /** One-line meaning, the same for every format. */
  summary: string;
  /** What judges look for, per format. */
  guidance: Readonly<Record<RatedFormat, readonly string[]>>;
}

/** Each criterion is scored 0..MAX in STEP increments, equal weight. */
export const CRITERION_MAX_SCORE = 10;
export const CRITERION_STEP = 0.5;

export const RATING_CRITERIA: readonly RatingCriterion[] = [
  {
    key: "difficulty",
    label: "Difficulty",
    summary: "How hard each trick is, and how hard the run is overall.",
    guidance: {
      park: [
        "Rotation complexity: spins, flips, corks.",
        "Technical grabs and their variations.",
        "Advanced tricks: grinds, transfers, switch tricks, disasters.",
        "Lines that connect tricks back to back.",
      ],
      street: [
        "Technical grinds, switch and fakie entries and exits.",
        "Spin-in and spin-out combinations; topside, negative and unity grinds.",
        "Gaps, transfers between obstacles and back-to-back sequences.",
        "High-risk obstacles (long or tall rails, stairs, big gaps) count for commitment.",
      ],
      vert: [
        "Grabbed airs and grabbed flips (McTwists, flatspins, corks, flairs, off-axis) from 360° to 1260°+.",
        "Rotations combined with grabs; inverts or spins with grabs.",
        "Risky technical grinds, single or switch-ups.",
        "Fakie or illusion take-offs, blind landings and channel transfers.",
      ],
    },
  },
  {
    key: "style",
    label: "Style",
    summary: "How clean and controlled each trick and the whole run look.",
    guidance: {
      park: [
        "Clean take-offs and landings.",
        "Stability and control in the air; smooth re-entry on transitions.",
        "Locked-in grinds and controlled stalls.",
        "No sketchy landings and no hand or foot drags.",
      ],
      street: [
        "Clean approach and stable body control.",
        "Precise grind lock-ins and a good slide.",
        "Balanced posture; clean entries, landings and exits.",
        "Confidence, and risks that are landed.",
      ],
      vert: [
        "Clean take-offs and a stable axis.",
        "Secure grabs, without flailing arms or loss of control.",
        "Controlled re-entry on the transition.",
        "Clean landings without hand or foot drags; a personal way of doing tricks.",
      ],
    },
  },
  {
    key: "amplitude",
    label: "Amplitude",
    summary: "Height and distance, rewarded only when combined with control.",
    guidance: {
      park: [
        "Height and extension on airs, transfers and transitions.",
        "Strong speed from pumping and carving.",
        "Reward height only when the trick is controlled and clean.",
      ],
      street: [
        "Long, stable slides.",
        "Airs, transfers and disasters across the street park.",
        "Speed kept up with fluid control through transitions.",
        "Reward height only when the trick is controlled and clean.",
      ],
      vert: [
        "Strong speed and vertical extension.",
        "Every trick at or above the coping.",
        "Height kept across the whole run, not only the first walls.",
        "Transfer airs and alley-oops instead of static panels.",
      ],
    },
  },
  {
    key: "consistency",
    label: "Consistency",
    summary: "A smooth, unbroken run at steady speed.",
    guidance: {
      park: [
        "Smooth transitions and connections between tricks and obstacles.",
        "Steady speed and logical, efficient lines.",
        "Stopping, extra pushing or losing momentum lowers this score.",
      ],
      street: [
        "Steady speed and logical, efficient lines.",
        "Few or no stops or hesitations.",
        "Mistakes and falls lower this score proportionally.",
      ],
      vert: [
        "Smooth connections from wall to wall.",
        "Steady speed and few or no hesitations.",
        "Stopping or losing momentum lowers this score.",
      ],
    },
  },
  {
    key: "creativity",
    label: "Creativity",
    summary: "Variety and original lines that add to the run, never replace difficulty.",
    guidance: {
      park: [
        "Use of many parts of the bowl and different directions.",
        "Unique or unexpected lines; original tricks or variations.",
        "Transfers between obstacles and a mix of airs, spins, grinds and flips.",
        "Repeating a trick or staying in one section limits this score.",
      ],
      street: [
        "Connected tricks, changes of direction and use of many obstacles.",
        "Unique or unexpected lines and transfers.",
        "A balanced mix of airs, grinds, transfers, spins and flips across grind families.",
        "A strategic choice of tricks across the run.",
      ],
      vert: [
        "Different grabs and a variety of rotations.",
        "Axis changes and switch or fakie tricks.",
        "Smart placement of consecutive tricks and use of channels and extensions.",
        "Unique lines and an original choice of tricks.",
      ],
    },
  },
];

/** Street best trick: two sub-scores, same scale as the criteria. */
export const BEST_TRICK_KEYS = ["difficulty", "execution"] as const;
export type BestTrickKey = (typeof BEST_TRICK_KEYS)[number];

export function criterionByKey(key: RatingCriterionKey): RatingCriterion {
  const found = RATING_CRITERIA.find((criterion) => criterion.key === key);
  if (!found) throw new Error(`Unknown criterion ${key}`);
  return found;
}
