import "../src/db/load-env"
import { closeDb, getDbClient } from "@/lib/db/client"
import {
  migrateSpots,
  validateSpots,
  type MigrateSpotsOptions,
  type MigrateSpotsResult,
  type ValidateSpotsResult,
} from "@/db/seed-data/spots-migration"

export {
  migrateSpots,
  validateSpots,
  type MigrateSpotsOptions,
  type MigrateSpotsResult,
  type ValidateSpotsResult,
}

function parseCliArgs(): {
  isValidate: boolean
  limit?: number
  chunkSize?: number
  upsert?: boolean
} {
  const args = process.argv.slice(2)
  let isValidate = false
  let limit: number | undefined
  let chunkSize: number | undefined
  let upsert = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "validate" || arg === "--validate" || arg === "--dry-run") {
      isValidate = true
    } else if (arg === "--upsert") {
      upsert = true
    } else if (arg === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]!, 10)
      i += 1
    } else if (arg === "--chunk" && args[i + 1]) {
      chunkSize = parseInt(args[i + 1]!, 10)
      i += 1
    }
  }

  return { isValidate, limit, chunkSize, upsert }
}

async function main(): Promise<void> {
  const { isValidate, limit, chunkSize, upsert } = parseCliArgs()

  if (isValidate) {
    console.log("Validating spots dataset offline from src/data/spots.json...")
    const result = validateSpots({ limit })

    console.log(`\nValidation successful!`)
    console.log(`- Total Spots: ${result.totalSpots}`)
    console.log(`- Spots with Images: ${result.withImages} (${result.totalImages} total image paths)`)
    console.log(`- Unique Countries: ${result.uniqueCountries}`)
    console.log(`- Geographic Bounds: lat [${result.bounds.minLat}, ${result.bounds.maxLat}], lon [${result.bounds.minLon}, ${result.bounds.maxLon}]`)

    console.log("\nTop 10 Countries by Spot Count:")
    const sortedCountries = Object.entries(result.byCountry)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
    for (const [code, count] of sortedCountries) {
      console.log(`  ${code}: ${count} spots`)
    }

    console.log("\nSpots by Discipline:")
    for (const [discipline, count] of Object.entries(result.byDiscipline)) {
      console.log(`  ${discipline}: ${count}`)
    }

    console.log("\nSpots by Type:")
    for (const [type, count] of Object.entries(result.byType)) {
      console.log(`  ${type}: ${count}`)
    }

    return
  }

  console.log(`Connecting to database to migrate spots from src/data/spots.json...`)
  const { db } = getDbClient()
  try {
    const result = await migrateSpots(db, {
      limit,
      chunkSize,
      upsert,
      onProgress: ({ phase, completed, total }) => {
        const pct = Math.round((completed / total) * 100)
        process.stdout.write(`\r[spots-migration] ${phase}: ${completed}/${total} (${pct}%)`)
      },
    })

    console.log(`\n\nSpots migration completed in ${(result.durationMs / 1000).toFixed(2)}s:`)
    console.log(`- Spots: ${result.spots}`)
    console.log(`- Images: ${result.images}`)
    console.log(`- Disciplines: ${result.disciplines}`)
    console.log(`- Type Assignments: ${result.typeAssignments}`)
  } finally {
    await closeDb()
  }
}

if (process.argv[1]?.endsWith("migrate-spots.ts")) {
  main().catch((error) => {
    console.error("\nSpots migration failed:", error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
