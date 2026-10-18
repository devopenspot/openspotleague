export interface TaxonomyEntry {
  slug: string
  name: string
  sortOrder: number
}

export interface TaxonomyPatch {
  name?: string
  sortOrder?: number
}

export interface TrickCatalogEntry {
  sourceId: string
  name: string
  description: string
  level: 1 | 2 | 3 | 4 | 5
  compatibleSpotTypes: readonly string[]
  categories: readonly string[]
}

export interface TrickCatalog {
  disciplineSlug: string
  challengeKey: string
  gameName: string
  eliminationWord: string
  tricks: readonly TrickCatalogEntry[]
  createdAt: string
  updatedAt?: string
  version?: number
}

export interface TrickMutationOptions {
  expectedUpdatedAt?: string
  actorId?: string | null
}

export interface TaxonomyRepository {
  listSports(): Promise<readonly TaxonomyEntry[]>
  listEventCategories(): Promise<readonly TaxonomyEntry[]>
  updateSport(slug: string, patch: TaxonomyPatch): Promise<TaxonomyEntry>
  deleteSport(slug: string): Promise<void>
  listSpotTypes(): Promise<readonly TaxonomyEntry[]>
  createSpotType(input: TaxonomyEntry): Promise<TaxonomyEntry>
  updateSpotType(slug: string, patch: TaxonomyPatch): Promise<TaxonomyEntry>
  deleteSpotType(slug: string): Promise<void>
  listCurrentTrickCatalogs(): Promise<readonly TrickCatalog[]>
  saveTrick(
    disciplineSlug: string,
    trick: TrickCatalogEntry,
    options?: TrickMutationOptions,
  ): Promise<TrickCatalogEntry>
  deleteTrick(
    disciplineSlug: string,
    sourceId: string,
    options?: TrickMutationOptions,
  ): Promise<void>
}
