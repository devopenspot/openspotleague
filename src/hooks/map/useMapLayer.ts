"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { MapLayerSchema, type MapLayer } from "@/lib/schemas/event";

/**
 * Minimal input the map UI needs to render the spots / events
 * layers and the layer toggle. The URL is the single source of
 * truth — this hook reads it via `useSearchParams` and writes
 * through `router.replace` so the back button clears one layer
 * at a time.
 *
 * Each `MapLayer` is an independent toggle. The absence of the
 * `?layer` param means only spots are on (the default); the param
 * carries a comma-separated subset. A
 * toggle that would empty the set is a no-op — the map is never
 * allowed to render with zero layers visible.
 */
export interface MapLayerState {
  enabled: ReadonlySet<MapLayer>;
  isEnabled: (layer: MapLayer) => boolean;
  toggle: (layer: MapLayer) => void;
}

const ALL_LAYERS: readonly MapLayer[] = MapLayerSchema.options;
const DEFAULT_LAYERS: readonly MapLayer[] = ["spots"];
const LayerListSchema = z.array(MapLayerSchema);

function isMapLayer(value: string): value is MapLayer {
  return MapLayerSchema.safeParse(value).success;
}

function parseEnabled(raw: string | null): ReadonlySet<MapLayer> {
  if (raw === null || raw === "") {
    return new Set(DEFAULT_LAYERS);
  }
  const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
  const parsed = LayerListSchema.safeParse(tokens);
  if (!parsed.success) {
    return new Set(ALL_LAYERS);
  }
  return new Set(parsed.data);
}

function serialize(enabled: ReadonlySet<MapLayer>): string | null {
  if (
    enabled.size === DEFAULT_LAYERS.length &&
    DEFAULT_LAYERS.every((layer) => enabled.has(layer))
  ) {
    return null;
  }
  return ALL_LAYERS.filter((l) => enabled.has(l)).join(",");
}

export function useMapLayer(): MapLayerState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawLayer = searchParams.get("layer");
  const enabled = useMemo(() => parseEnabled(rawLayer), [rawLayer]);

  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const isEnabled = useCallback(
    (layer: MapLayer) => enabled.has(layer),
    [enabled],
  );

  const toggle = useCallback(
    (layer: MapLayer) => {
      if (!isMapLayer(layer)) return;
      const next = new Set(enabled);
      if (next.has(layer)) {
        if (next.size <= 1) return;
        next.delete(layer);
      } else {
        next.add(layer);
      }
      const serialized = serialize(next);
      writeParams((params) => {
        if (serialized === null) {
          params.delete("layer");
        } else {
          params.set("layer", serialized);
        }
      });
    },
    [enabled, writeParams],
  );

  return { enabled, isEnabled, toggle };
}
