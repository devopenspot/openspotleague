import { and, desc, eq } from "drizzle-orm"
import { getDbClient, withDbRead } from "@/lib/db/client"
import { spotChallengeRecords } from "@/db/schema"

export async function listCompletedChallengesForSpot(spotId: string, limit = 50) {
  const { db } = getDbClient()
  return withDbRead("challenge_history.list", () =>
    db.transaction((tx) =>
      tx.select().from(spotChallengeRecords).where(and(
        eq(spotChallengeRecords.spotId, spotId),
        eq(spotChallengeRecords.status, "completed"),
      )).orderBy(desc(spotChallengeRecords.completedAt)).limit(limit),
    ),
  )
}
