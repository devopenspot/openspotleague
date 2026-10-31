const JOIN_PATH = /^\/games\/join\/([^/?#]+)/
const SHORT_LINK_PATH = /^\/s\/[A-Za-z0-9_-]+$/

/**
 * Where a pasted share code or invite link should go. Only this app's own join
 * paths are followed, so pasted text can never navigate somewhere else. Share
 * codes are case-sensitive, so they pass through unchanged.
 */
export function resolveJoinPath(input: string): string | null {
  const value = input.trim()
  if (!value) return null

  let pathname: string | null = null
  if (value.startsWith("/")) {
    pathname = value.split(/[?#]/)[0] ?? null
  } else if (/^https?:\/\//i.test(value)) {
    try {
      pathname = new URL(value).pathname
    } catch {
      return null
    }
  }

  if (pathname === null) return `/games/join/${encodeURIComponent(value)}`
  const joinCode = JOIN_PATH.exec(pathname)?.[1]
  if (joinCode) return `/games/join/${joinCode}`
  return SHORT_LINK_PATH.test(pathname) ? pathname : null
}
