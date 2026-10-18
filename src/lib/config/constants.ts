export const MAIN_CONTENT_ID = "main-content";

export const CROWD_LEVEL = {
  LOW_MAX: 40,
  HIGH_MIN: 70,
} as const;

export const MAP_VIEWPORT_OFFSET_PX = {
  DESKTOP: 60,
  MOBILE: 160,
} as const;

export const SEARCH_FOCUS_DELAY_MS = 150;

/**
 * Searcher progressive-render chunks (`useProgressiveList`). Lists at or
 * below the initial chunk render fully, exactly as before; longer lists
 * reveal further chunks as their end sentinel approaches the viewport.
 * City rows are short (~44px) so they reveal in a larger batch; matched
 * spot rows are tall (~80px, images/tiles) so they reveal in a smaller one.
 */
export const SEARCH_CITY_INITIAL_CHUNK = 40;
export const SEARCH_CITY_STEP_CHUNK = 40;
export const SEARCH_MATCH_INITIAL_CHUNK = 20;
export const SEARCH_MATCH_STEP_CHUNK = 20;

export const SPOT_LIST_HARD_CAP = 500;
export const EVENT_LIST_HARD_CAP = 200;
export const NEARBY_RADIUS_CAP_METERS = 50_000;
/**
 * Query radius for the map's Nearby mode (100 mi — the largest radius chip).
 * The hydrated client directory is capped at `SPOT_LIST_HARD_CAP` name-ordered
 * rows, so a haversine radius filter over it alone finds zero spots for most
 * users of the seeded catalog. Nearby instead walks `repo.list({ near })`
 * (cursor-paged `ST_DWithin` reads, see `useNearbySpots`) at this maximum
 * radius once per granted position; smaller radius chips re-filter the same
 * dataset locally, keeping the instant chip UX.
 */
export const MAP_NEARBY_MAX_RADIUS_METERS = 160_934;
/**
 * Radius of the map's city-scope walk: when a city is committed, the
 * rendered set widens from "the city's spots" to "the city's spots ∪
 * every public spot within this distance of the city spots' centroid"
 * (border-crossing rows included — the scope is distance-based, like
 * Nearby mode). Transported by `useCityRadiusSpots` over the same
 * cursor-paged `GET /api/spots?near=` read; sits far below the API's
 * `MAP_NEARBY_MAX_RADIUS_METERS` query bound.
 */
export const MAP_CITY_RADIUS_METERS = 28_000;
export const MAX_SPOT_IDS_PER_REQUEST = 50;
export const MAX_CONCURRENT_WEATHER = 6;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const DEFAULT_GAME_HISTORY_LIMIT = 20;
export const MAX_GAME_HISTORY_LIMIT = 50;

export const COMMUNITY_RADIUS_METERS = 300;
export const MAX_LOCATION_ACCURACY_METERS = 100;
export const COMMUNITY_PROMOTION_THRESHOLD = 2;
