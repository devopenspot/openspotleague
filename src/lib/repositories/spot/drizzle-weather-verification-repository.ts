import { and, count, eq, gt, sql } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import { spotWeatherVerifications } from "@/db/schema"
import type { WeatherVerificationRepository, WeatherVerificationSummary } from "./weather-verification-repository"
import type { WeatherIconName } from "@/lib/types"
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon"

export class DrizzleWeatherVerificationRepository implements WeatherVerificationRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async getActiveSummary(spotId: string): Promise<WeatherVerificationSummary> {
    const now = new Date()
    // 1 single query (1 RTT) computing counts, tie-breaker max(createdAt), and max(expiresAt)
    const rows = await this.db
      .select({
        voteIcon: spotWeatherVerifications.voteIcon,
        c: count(),
        latestCreatedAt: sql<Date | string>`max(${spotWeatherVerifications.createdAt})`,
        maxExpiresAt: sql<Date | string>`max(${spotWeatherVerifications.expiresAt})`,
      })
      .from(spotWeatherVerifications)
      .where(
        and(
          eq(spotWeatherVerifications.spotId, spotId),
          gt(spotWeatherVerifications.expiresAt, now),
        ),
      )
      .groupBy(spotWeatherVerifications.voteIcon)

    if (rows.length === 0) {
      return { active: false, leader: null, count: 0, expiresAt: null, totalActive: 0 }
    }

    let leaderIcon = rows[0]!.voteIcon
    let maxCount = Number(rows[0]!.c)
    let leaderCreatedAt = new Date(rows[0]!.latestCreatedAt).getTime()
    let latestExpiresAtMs = new Date(rows[0]!.maxExpiresAt).getTime()
    let totalActive = 0

    for (const r of rows) {
      const c = Number(r.c)
      const createdAtMs = new Date(r.latestCreatedAt).getTime()
      const expiresAtMs = new Date(r.maxExpiresAt).getTime()

      totalActive += c
      if (expiresAtMs > latestExpiresAtMs) {
        latestExpiresAtMs = expiresAtMs
      }

      if (c > maxCount || (c === maxCount && createdAtMs > leaderCreatedAt)) {
        maxCount = c
        leaderIcon = r.voteIcon
        leaderCreatedAt = createdAtMs
      }
    }

    const validatedLeader: WeatherIconName | null = isWeatherIconName(leaderIcon) ? leaderIcon : null

    return {
      active: true,
      leader: validatedLeader,
      count: maxCount,
      expiresAt: Number.isFinite(latestExpiresAtMs) ? new Date(latestExpiresAtMs).toISOString() : null,
      totalActive,
    }
  }

  async findLastVerificationAt(userId: string, spotId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: spotWeatherVerifications.createdAt })
      .from(spotWeatherVerifications)
      .where(
        and(
          eq(spotWeatherVerifications.userId, userId),
          eq(spotWeatherVerifications.spotId, spotId),
        ),
      )
      .orderBy(sql`${spotWeatherVerifications.createdAt} desc`)
      .limit(1)
    return row?.createdAt ?? null
  }

  async create(params: { spotId: string; userId: string; voteIcon: string; expiresAt: Date }): Promise<void> {
    await this.db.insert(spotWeatherVerifications).values({
      spotId: params.spotId,
      userId: params.userId,
      voteIcon: params.voteIcon as never,
      expiresAt: params.expiresAt,
    })
  }

  async listActive(spotId: string): Promise<readonly { voteIcon: string; createdAt: Date; expiresAt: Date }[]> {
    const now = new Date()
    const rows = await this.db
      .select({
        voteIcon: spotWeatherVerifications.voteIcon,
        createdAt: spotWeatherVerifications.createdAt,
        expiresAt: spotWeatherVerifications.expiresAt,
      })
      .from(spotWeatherVerifications)
      .where(
        and(eq(spotWeatherVerifications.spotId, spotId), gt(spotWeatherVerifications.expiresAt, now)),
      )
      .orderBy(sql`${spotWeatherVerifications.createdAt} desc`)
    return rows as never
  }
}
