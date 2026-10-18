// Deterministic TV videos seed from src/data/videos_tv.json fixture.
// Usage: pnpm db:seed-tv

import "./load-env"
import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { closeDb, getDbClient } from "@/lib/db/client"
import { tvVideos } from "@/db/schema"
import { log } from "@/lib/utils/log"
import { SPORT_DISCIPLINE_SEED } from "./seed-data/taxonomy"

type Db = ReturnType<typeof getDbClient>["db"]

const validDisciplines = SPORT_DISCIPLINE_SEED.map((d) => d.slug) as [string, ...string[]]

const RawVideoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  youtube_url: z.string().url(),
  discipline_slug: z.enum(validDisciplines),
  categories: z.array(z.string().min(1)).min(1).max(12),
  post_date: z.string().min(1),
  published: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export function loadTvVideos() {
  const filePath = path.join(process.cwd(), "src", "data", "videos_tv.json")
  const raw = JSON.parse(readFileSync(filePath, "utf8"))
  return z.array(RawVideoSchema).parse(raw)
}

export async function seedTvVideos(db: Db): Promise<{ count: number }> {
  const rawVideos = loadTvVideos()
  log.info("seed.tv.start", { count: rawVideos.length })

  const rows = rawVideos.map((video) => ({
    id: video.id,
    title: video.title,
    youtubeUrl: video.youtube_url,
    disciplineSlug: video.discipline_slug,
    categories: video.categories,
    postDate: new Date(video.post_date),
    published: video.published,
    sortOrder: video.sort_order,
    createdBy: null,
    updatedBy: null,
    createdAt: video.created_at ? new Date(video.created_at) : new Date(),
    updatedAt: video.updated_at ? new Date(video.updated_at) : new Date(),
  }))

  const CHUNK_SIZE = 100
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      await tx
        .insert(tvVideos)
        .values(chunk)
        .onConflictDoUpdate({
          target: tvVideos.id,
          set: {
            title: tvVideos.title,
            youtubeUrl: tvVideos.youtubeUrl,
            disciplineSlug: tvVideos.disciplineSlug,
            categories: tvVideos.categories,
            postDate: tvVideos.postDate,
            published: tvVideos.published,
            sortOrder: tvVideos.sortOrder,
            updatedAt: new Date(),
          },
        })
    }
  })

  log.info("seed.tv.done", { count: rows.length })
  return { count: rows.length }
}

async function main() {
  const { db } = getDbClient()
  try {
    const { count } = await seedTvVideos(db)
    console.log(`✓ seeded ${count} TV videos`)
  } finally {
    await closeDb()
  }
}

// Only auto-run if executed directly as a script
if (process.argv[1]?.endsWith("seed-tv.ts")) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
