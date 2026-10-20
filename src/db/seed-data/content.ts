import { z } from "zod"
import spotsSource from "@/data/spots.json"
import {
  ContentSourceSpotSchema,
  ContentSourceSpotTypeAssignmentSchema,
} from "@/lib/schemas/content-source"
import { COUNTRY_TO_ISO2 } from "./iso-codes"
import {
  SPORT_DISCIPLINE_SEED,
  SPOT_TYPE_SEED,
} from "./taxonomy"

const disciplineTitles = SPORT_DISCIPLINE_SEED.map((entry) => entry.slug) as [
  string,
  ...string[],
]
const disciplineTitleSchema = z.string().transform((value) => value.toLowerCase()).pipe(z.enum(disciplineTitles))
const countryCodes = Object.values(COUNTRY_TO_ISO2) as [string, ...string[]]
const countryCodeSchema = z.enum(countryCodes)
const spotTypeSlugs = SPOT_TYPE_SEED.map((entry) => entry.slug) as [
  string,
  ...string[],
]
const spotTypeSchema = z.enum(spotTypeSlugs)

const rawSpotSchema = ContentSourceSpotSchema.extend({
  country_code: countryCodeSchema,
  sports: z.array(disciplineTitleSchema).min(1),
})

const rawSpotTypeAssignmentSchema = ContentSourceSpotTypeAssignmentSchema.extend({
  type_slug: spotTypeSchema,
})

export interface NormalizedSpot {
  id: string
  slug: string
  name: string
  city: string
  citySlug: string
  address: string
  imageUrl: string | null
  images: readonly string[]
  countryCode: string
  instagram: string | null
  verificationCount: number
  location: { lat: number; lon: number }
  sports: readonly string[]
  types: readonly { name: string; slug: string }[]
  createdAt?: Date
  updatedAt?: Date
}

export interface NormalizedSpotTypeAssignment {
  spotId: string
  typeSlug: string
}

export interface NormalizedContentSources {
  spots: readonly NormalizedSpot[]
  spotTypeAssignments: readonly NormalizedSpotTypeAssignment[]
}

function decodeEwkb(value: string): { lat: number; lon: number } {
  if (!/^[0-9a-f]+$/i.test(value) || value.length !== 50) {
    throw new Error(`Expected a PostGIS EWKB point, received ${value}`)
  }
  const bytes = Buffer.from(value, "hex")
  const littleEndian = bytes[0] === 1
  if (bytes[0] !== 0 && bytes[0] !== 1) {
    throw new Error(`Unsupported EWKB byte order for ${value}`)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const type = view.getUint32(1, littleEndian)
  const hasSrid = (type & 0x20000000) !== 0
  if ((type & 0x0fffffff) !== 1 || !hasSrid) {
    throw new Error(`Expected an EWKB Point with SRID for ${value}`)
  }
  const srid = view.getUint32(5, littleEndian)
  if (srid !== 4326) throw new Error(`Expected SRID 4326, received ${srid}`)
  const lon = view.getFloat64(9, littleEndian)
  const lat = view.getFloat64(17, littleEndian)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`EWKB contains non-finite coordinates: ${value}`)
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`EWKB coordinates are out of range: ${value}`)
  }
  return { lat, lon }
}

function unique<T>(values: readonly T[], label: string): readonly T[] {
  const result = [...new Set(values)]
  if (result.length !== values.length) throw new Error(`Duplicate ${label}`)
  return result
}

function disciplineSlugs(values: readonly string[]): readonly string[] {
  return unique(values.map((title) => title.toLowerCase()), "discipline assignments")
}

export function loadContentSources(): NormalizedContentSources {
  const rawSpots = z.array(rawSpotSchema).parse(spotsSource)

  if (rawSpots.length < 1) throw new Error(`Expected migrated spots, found ${rawSpots.length}`)

  const extractedAssignments = rawSpots.flatMap((spot) =>
    spot.types.map((typeObj) => ({
      spot_id: spot.id,
      type_slug: typeObj.slug,
    })),
  )

  const rawSpotTypeAssignments = z
    .array(rawSpotTypeAssignmentSchema)
    .parse(extractedAssignments)

  if (rawSpotTypeAssignments.length < 1) {
    throw new Error(`Expected spot-type assignments, found ${rawSpotTypeAssignments.length}`)
  }

  unique(rawSpots.map((spot) => spot.id), "spot ids")
  unique(rawSpots.map((spot) => spot.slug), "spot slugs")
  unique(
    rawSpotTypeAssignments.map((assignment) => `${assignment.spot_id}:${assignment.type_slug}`),
    "spot-type assignments",
  )

  const spots: NormalizedSpot[] = rawSpots.map((spot) => ({
    id: spot.id,
    slug: spot.slug,
    name: spot.name,
    city: spot.city,
    citySlug: spot.city_slug,
    address: spot.address,
    imageUrl: spot.image_url ?? null,
    images: spot.images,
    countryCode: spot.country_code,
    instagram: spot.instagram ?? null,
    verificationCount: spot.verification_count,
    location: decodeEwkb(spot.location),
    sports: disciplineSlugs(spot.sports),
    types: spot.types,
    createdAt: spot.created_at ? new Date(spot.created_at) : undefined,
    updatedAt: spot.updated_at ? new Date(spot.updated_at) : undefined,
  }))

  return {
    spots,
    spotTypeAssignments: rawSpotTypeAssignments.map((assignment) => ({
      spotId: assignment.spot_id,
      typeSlug: assignment.type_slug,
    })),
  }
}
