export interface TaxonomyEntry {
  slug: string;
  name: string;
  sortOrder: number;
}

export const SPOT_TYPE_SEED: readonly TaxonomyEntry[] = [
  { slug: "plaza", name: "Plaza", sortOrder: 0 },
  { slug: "diy", name: "DIY", sortOrder: 1 },
  { slug: "stair", name: "Stair", sortOrder: 2 },
  { slug: "bowl", name: "Bowl", sortOrder: 3 },
  { slug: "skatepark", name: "Skatepark", sortOrder: 4 },
  { slug: "ledges", name: "Ledges", sortOrder: 5 },
  { slug: "vert", name: "Vert", sortOrder: 6 },
  { slug: "rails", name: "Rails", sortOrder: 7 },
  { slug: "box", name: "Box", sortOrder: 9 },
  { slug: "ramp", name: "Ramp", sortOrder: 10 },
  { slug: "flatground", name: "Flatground", sortOrder: 11 },
  { slug: "mini-ramp", name: "Mini Ramp", sortOrder: 12 },
  { slug: "flybox", name: "Flybox", sortOrder: 13 },
  { slug: "pump-track", name: "Pump Track", sortOrder: 14 },
];

export const SPORT_DISCIPLINE_SEED: readonly TaxonomyEntry[] = [
  { slug: "skateboard", name: "Skateboard", sortOrder: 0 },
  { slug: "bmx", name: "BMX", sortOrder: 1 },
  { slug: "scooter", name: "Scooter", sortOrder: 2 },
  { slug: "roller", name: "Roller", sortOrder: 3 },
];

export const EVENT_CATEGORY_SEED: readonly TaxonomyEntry[] = [
  { slug: "world-tour", name: "World Tour", sortOrder: 0 },
  { slug: "championship", name: "Championship", sortOrder: 1 },
  { slug: "festival", name: "Festival", sortOrder: 2 },
  { slug: "federation", name: "Federation", sortOrder: 3 },
  { slug: "local-event", name: "Local Event", sortOrder: 4 },
];
