"use client";

import { useSearchParams } from "next/navigation";
import { requestedMapMode } from "@/components/map/shared/map-mode";

export function useMapMode() {
  const searchParams = useSearchParams();
  return requestedMapMode(new URLSearchParams(searchParams.toString()));
}
