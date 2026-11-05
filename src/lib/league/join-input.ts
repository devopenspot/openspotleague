const JOIN_PATH = /^\/sport-events\/join\/([^/?#]+)/;

/**
 * Where a pasted invite code or event invite link should go. Only this app's
 * own sport-events join paths are followed, so pasted text can never navigate
 * somewhere else. Invite codes are case-sensitive, so they pass through unchanged.
 */
export function resolveEventJoinPath(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  let pathname: string | null = null;
  if (value.startsWith("/")) {
    pathname = value.split(/[?#]/)[0] ?? null;
  } else if (/^https?:\/\//i.test(value)) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  if (pathname === null) {
    return `/sport-events/join/${encodeURIComponent(value)}`;
  }
  const joinCode = JOIN_PATH.exec(pathname)?.[1];
  if (joinCode) return `/sport-events/join/${joinCode}`;
  return null;
}
