"use client";

import { useEffect, useState } from "react";
import {
  getOrFetchShortUrl,
  resolveCanonicalShareUrl,
} from "@/lib/utils/short-url";

/**
 * Resolves the short link ahead of time: `navigator.share` needs a live tap,
 * which Safari drops across an `await` in the click handler.
 */
export function useShareUrl(path: string, title: string) {
  const [shortUrl, setShortUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getOrFetchShortUrl(path, title).then((resolved) => {
      if (active) setShortUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [path, title]);

  return shortUrl ?? resolveCanonicalShareUrl(path);
}
