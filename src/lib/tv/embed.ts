/**
 * Turns a YouTube embedUrl (autoplay=0) into an autoplay variant.
 * Keeps existing params (controls, playsinline, rel) and adds autoplay/mute/enablejsapi
 * for queue navigation without extra user tap.
 */
export function toAutoplayEmbedUrl(
  embedUrl: string,
  opts: { autoplay?: boolean; muted?: boolean; enableJsApi?: boolean } = {},
): string {
  const { autoplay = true, muted, enableJsApi } = opts;
  const isMuted = muted ?? (autoplay ? true : false);
  const shouldEnableJsApi = enableJsApi ?? autoplay;
  try {
    const url = new URL(embedUrl);
    url.searchParams.set("autoplay", autoplay ? "1" : "0");
    if (isMuted) url.searchParams.set("mute", "1");
    else url.searchParams.delete("mute");
    url.searchParams.set("controls", "1");
    // Inline playback on iOS (no fullscreen takeover) + minimal related UI for queue flow
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("rel", "0");
    url.searchParams.set("iv_load_policy", "3");
    url.searchParams.set("modestbranding", "1");
    if (shouldEnableJsApi) url.searchParams.set("enablejsapi", "1");
    else url.searchParams.delete("enablejsapi");
    // Performance: only add origin when jsapi enabled (saves a query param otherwise)
    if (shouldEnableJsApi && typeof window !== "undefined" && window.location.origin) {
      url.searchParams.set("origin", window.location.origin);
    }
    return url.toString();
  } catch {
    return embedUrl;
  }
}
