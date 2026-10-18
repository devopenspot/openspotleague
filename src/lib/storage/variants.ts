export type ImageVariant = "thumb" | "card" | "detail" | "master"

export function getVariantPath(masterPath: string, variant: ImageVariant): string {
  if (variant === "master") return masterPath
  if (!masterPath.endsWith(".webp")) return masterPath
  const base = masterPath.slice(0, -5)
  switch (variant) {
    case "thumb":
      return `${base}_128.webp`
    case "card":
      return `${base}_400.webp`
    case "detail":
      return `${base}_800.webp`
    default:
      return masterPath
  }
}

export function getVariantPaths(masterPath: string): Record<ImageVariant, string> {
  return {
    master: masterPath,
    thumb: getVariantPath(masterPath, "thumb"),
    card: getVariantPath(masterPath, "card"),
    detail: getVariantPath(masterPath, "detail"),
  }
}

export function variantPathsList(master: string): string[] {
  if (!master.endsWith(".webp")) return [master]
  const base = master.slice(0, -5)
  return [master, `${base}_128.webp`, `${base}_400.webp`, `${base}_800.webp`]
}

export function extractStoragePath(cdnUrl: string | null): string | null {
  if (!cdnUrl) return null
  // Already a path (spots/..., events/...) — return as-is
  if (cdnUrl.startsWith("spots/") || cdnUrl.startsWith("events/")) return cdnUrl
  try {
    const u = new URL(cdnUrl)
    // CDN hosts: spots.cdn..., events.cdn..., cdn..., supabase storage fallback
    const pathname = u.pathname.replace(/^\//, "")
    // Supabase public URL includes /storage/v1/object/public/<bucket>/...
    if (pathname.includes("/storage/v1/object/")) {
      const parts = pathname.split("/storage/v1/object/public/")
      if (parts[1]) return parts[1].split("/").slice(1).join("/") // strip bucket
      return null
    }
    // placeholder.local — decode
    if (u.hostname === "placeholder.local") return decodeURIComponent(pathname)
    // R2 CDN — pathname is the storage key directly
    if (pathname.startsWith("spots/") || pathname.startsWith("events/")) return pathname
    return null
  } catch {
    return null
  }
}

export function cdnUrlToVariantUrl(cdnUrl: string, variant: ImageVariant): string {
  const path = extractStoragePath(cdnUrl)
  if (!path) return cdnUrl
  return cdnUrl.replace(path, getVariantPath(path, variant))
}
