const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
])

export interface ParsedYouTubeVideoUrl {
  canonicalUrl: string
  embedUrl: string
}

function cleanPathPart(value: string): string | null {
  const decoded = decodeURIComponent(value).trim()
  return /^[A-Za-z0-9_-]+$/.test(decoded) ? decoded : null
}

export function parseYouTubeVideoUrl(
  rawUrl: string,
): ParsedYouTubeVideoUrl | null {
  try {
    const url = new URL(rawUrl.trim())
    if (url.protocol !== "https:") return null
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null

    const videoId = url.hostname.toLowerCase() === "youtu.be"
      ? cleanPathPart(url.pathname.split("/")[1] ?? "")
      : cleanPathPart(
          url.searchParams.get("v") ??
            url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ??
            "",
        )

    if (!videoId || videoId.length < 6 || videoId.length > 20) return null

    return {
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&playsinline=1&rel=0`,
    }
  } catch {
    return null
  }
}

export function youtubeThumbUrl(url: string): string | null {
  const parsed = parseYouTubeVideoUrl(url)
  if (!parsed) return null
  try {
    const u = new URL(parsed.canonicalUrl)
    const id = u.searchParams.get("v")
    if (!id) return null
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  } catch {
    return null
  }
}
