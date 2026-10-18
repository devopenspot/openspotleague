import { and, count, desc, eq, gt, sql } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import { spotWeatherVerifications } from "@/db/schema"
import type { WeatherVerificationRepository } from "./weather-verification-repository"
import type { WeatherIconName } from "@/lib/types"
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon"

export class DrizzleWeatherVerificationRepository implements WeatherVerificationRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async getActiveSummary(spotId: string): Promise<{
    active: boolean
    leader: WeatherIconName | null
    count: number
    expiresAt: string | null
    totalActive: number
  }> {
    const now = new Date()
    // Aggregate active votes per icon, pick most voted
    const rows = await this.db
      .select({ voteIcon: spotWeatherVerifications.voteIcon, c: count() })
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

    let leader: WeatherIconName | string = rows[0]!.voteIcon as string
    let max = Number(rows[0]!.c)
    let total = 0
    for (const r of rows) {
      const c = Number(r.c)
      total += c
      if (c > max) {
        max = c
        leader = r.voteIcon as string
      }
    }

    // Tie-break: later createdAt wins among leaders — fetch latest among leaders
    const maxIcons = rows.filter((r) => Number(r.c) === max).map((r) => r.voteIcon as string)
    let tieLeader: WeatherIconName | string = leader
    if (maxIcons.length > 1) {
      const latest = await this.db
        .select({ voteIcon: spotWeatherVerifications.voteIcon, createdAt: spotWeatherVerifications.createdAt })
        .from(spotWeatherVerifications)
        .where(
          and(
            eq(spotWeatherVerifications.spotId, spotId),
            gt(spotWeatherVerifications.expiresAt, now),
            sql`${spotWeatherVerifications.voteIcon} in (${sql.join(maxIcons.map((v) => sql`${v}`), sql`, `)})`,
          ),
        )
        .orderBy(desc(spotWeatherVerifications.createdAt))
        .limit(1)
      if (latest[0]) tieLeader = latest[0].voteIcon as string
    }

    // Validate leader against union — protects against corrupted DB values
    const validatedLeader: WeatherIconName | null = isWeatherIconName(tieLeader) ? tieLeader : null

    // expiresAt = max expiresAt among active (last verification time +2h)
    const [expRow] = await this.db
      .select({ expiresAt: sql<Date>`max(${spotWeatherVerifications.expiresAt})` })
      .from(spotWeatherVerifications)
      .where(
        and(eq(spotWeatherVerifications.spotId, spotId), gt(spotWeatherVerifications.expiresAt, now)),
      )

    return {
      active: true,
      leader: validatedLeader,
      count: max,
      expiresAt: expRow?.expiresAt ? new Date(expRow.expiresAt as unknown as string).toISOString() : null,
      totalActive: total,
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
      .orderBy(desc(spotWeatherVerifications.createdAt))
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
      .orderBy(desc(spotWeatherVerifications.createdAt))
    return rows as never
  }
}
