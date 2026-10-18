import { eq } from "drizzle-orm";
import { profiles } from "@/db/schema";
import { getDbClient, withDbRead, withDbWrite } from "@/lib/db/client";
import {
  preferencesSchema,
  updatePreferencesSchema,
  type Preferences,
} from "@/lib/schemas/preferences";

export interface PreferenceProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
}

const DEFAULT_PREFERENCES: Preferences = {
  distanceUnit: "mi",
  temperatureUnit: "C",
  disciplineSlug: null,
};

export class ProfileNotFoundError extends Error {
  constructor(userId: string) {
    super(`Profile not found for user ${userId}`);
    this.name = "ProfileNotFoundError";
  }
}

export async function ensurePreferenceProfile(profile: PreferenceProfile): Promise<void> {
  const { db } = getDbClient();
  await withDbWrite("profiles.ensure", () =>
    db.transaction((tx) =>
      tx.insert(profiles).values({
        id: profile.id,
        displayName: profile.name,
        email: profile.email,
        initials: profile.initials,
      }).onConflictDoNothing({ target: profiles.id }),
    ),
  );
}

function project(row: typeof profiles.$inferSelect | undefined): Preferences {
  return preferencesSchema.parse({
    distanceUnit: row?.distanceUnit ?? DEFAULT_PREFERENCES.distanceUnit,
    temperatureUnit: row?.temperatureUnit ?? DEFAULT_PREFERENCES.temperatureUnit,
    disciplineSlug: row?.preferredDisciplineSlug ?? DEFAULT_PREFERENCES.disciplineSlug,
  });
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const { db } = getDbClient();
  const [row] = await withDbRead("profiles.get_preferences", () =>
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
  );
  return project(row);
}

export async function updatePreferences(
  userId: string,
  input: unknown,
): Promise<Preferences> {
  const patch = updatePreferencesSchema.parse(input);
  const { db } = getDbClient();
  const [row] = await withDbWrite("profiles.update_preferences", () =>
    db.transaction((tx) =>
      tx
        .update(profiles)
        .set({
          ...(patch.distanceUnit === undefined ? {} : { distanceUnit: patch.distanceUnit }),
          ...(patch.temperatureUnit === undefined ? {} : { temperatureUnit: patch.temperatureUnit }),
          ...(patch.disciplineSlug === undefined
            ? {}
            : { preferredDisciplineSlug: patch.disciplineSlug }),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, userId))
        .returning(),
    ),
  );
  if (!row) throw new ProfileNotFoundError(userId);
  return project(row);
}

export { DEFAULT_PREFERENCES };
