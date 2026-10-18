const raw = process.env.NEXT_PUBLIC_MAP_DISTANCE ?? "";
export const MAP_DISTANCE_UI_ENABLED = raw.trim().toLowerCase() !== "off";
