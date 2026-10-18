import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import { eq, desc } from "drizzle-orm"
import { getDbClient, withDbRead } from "@/lib/db/client"
import { spotWeatherReports } from "@/db/schema"
import { REPORT_CACHE_LIFE } from "@/lib/cache/lifetimes"

export interface SpotWeatherReport {
  id: string
  spotId: string
  gameId: string
  forecastIcon: string
  observedIcon: string
  confirmed: boolean
  createdAt: string
}

export async function getSpotLastWeatherReport(spotId: string): Promise<SpotWeatherReport | null> {
  "use cache"
  cacheTag(`spot-weather:${spotId}`)
  cacheLife(REPORT_CACHE_LIFE)
  const { db } = getDbClient()
  return withDbRead("spot-weather.last", async () => {
    const [row] = await db
      .select()
      .from(spotWeatherReports)
      .where(eq(spotWeatherReports.spotId, spotId))
      .orderBy(desc(spotWeatherReports.createdAt))
      .limit(1)
    if (!row) return null
    return {
      id: row.id,
      spotId: row.spotId,
      gameId: row.gameId,
      forecastIcon: row.forecastIcon,
      observedIcon: row.observedIcon,
      confirmed: row.confirmed,
      createdAt: row.createdAt.toISOString(),
    }
  })
}

export async function revalidateSpotWeather(spotId: string) {
  revalidateTag(`spot-weather:${spotId}`, REPORT_CACHE_LIFE)
}
