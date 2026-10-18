export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = (navigator as unknown as { platform?: string }).platform || "";
  const maxTouchPoints = (navigator as unknown as { maxTouchPoints?: number })
    .maxTouchPoints;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Mac/i.test(platform) && typeof maxTouchPoints === "number" && maxTouchPoints > 1) {
    // iPadOS 13+ reports as Mac
    return true;
  }
  return false;
}

export function shouldSuggestReloadForDenied(): boolean {
  return isIOS();
}

export function getLocationReloadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.sessionStorage.getItem("openspot:location-reload-count") || "0");
  } catch {
    return 0;
  }
}

function bumpLocationReloadCount(): void {
  if (typeof window === "undefined") return;
  try {
    const next = getLocationReloadCount() + 1;
    window.sessionStorage.setItem("openspot:location-reload-count", String(next));
    window.sessionStorage.setItem("openspot:location-reload", "1");
  } catch {
    // storage may be blocked
  }
}

export function reloadPage(): void {
  if (typeof window === "undefined") return;
  bumpLocationReloadCount();
  // Use hard navigation to bust WKWebView per-process cache; reload() alone may reuse same process
  const href = window.location.href;
  try {
    window.location.href = href;
  } catch {
    window.location.reload();
  }
}

export function clearLocationReloadFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem("openspot:location-reload");
  } catch {
    // ignore
  }
}
