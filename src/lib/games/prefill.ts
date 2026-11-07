import { z } from "zod";
import type { GameMode } from "@/lib/schemas/game";
import type { Spot } from "@/lib/types";

const GAME_PREFILL_MODE = ["training", "challenge"] as const;

export type GamePrefill = {
  spotId: string | null;
  spotType: string | null;
  mode: GameMode | null;
};

const spotIdSchema = z.string().uuid();
const spotTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/, "slug must be [a-z0-9-]");

const modeSchema = z.enum(GAME_PREFILL_MODE);

export function parseGamePrefill(
  searchParams: Pick<URLSearchParams, "get">,
): GamePrefill {
  const rawId = searchParams.get("spotId");
  const rawType = searchParams.get("spotType");
  const rawMode = searchParams.get("mode");
  const spotId =
    rawId && spotIdSchema.safeParse(rawId).success ? rawId : null;
  const normalizedType = rawType?.trim().toLowerCase() ?? null;
  const spotType =
    normalizedType && spotTypeSchema.safeParse(normalizedType).success
      ? normalizedType
      : null;
  const mode =
    rawMode && modeSchema.safeParse(rawMode).success
      ? (rawMode as GameMode)
      : null;
  return { spotId, spotType, mode };
}

export function buildGamePrefillUrl(
  spot: Pick<Spot, "id" | "types">,
  opts?: { spotType?: string | null; mode?: GameMode | null },
): string {
  const params = new URLSearchParams();
  params.set("spotId", spot.id);
  const explicitTypeRaw = (opts?.spotType ?? spot.types[0]?.slug ?? null) as
    | string
    | null;
  const explicitType = explicitTypeRaw?.trim().toLowerCase() ?? null;
  if (explicitType && spotTypeSchema.safeParse(explicitType).success) {
    params.set("spotType", explicitType);
  }
  if (opts?.mode && modeSchema.safeParse(opts.mode).success) {
    params.set("mode", opts.mode);
  }
  return `/games?${params.toString()}`;
}

/** "Run It Again": the setup page, opened on the same mode, spot and spot type. */
export function buildRunAgainUrl(game: {
  mode: GameMode;
  spotId: string | null;
  nextSpotType: string;
}): string {
  const params = new URLSearchParams();
  params.set("mode", game.mode);
  if (game.spotId && spotIdSchema.safeParse(game.spotId).success) {
    params.set("spotId", game.spotId);
  }
  const type = game.nextSpotType.trim().toLowerCase();
  if (spotTypeSchema.safeParse(type).success) params.set("spotType", type);
  return `/games?${params.toString()}`;
}
