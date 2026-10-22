import type { TabType } from "@/lib/types";
import {
  Heart,
  Trophy,
  ClipboardList,
  UserCircle,
  MapPinned,
  Tv,
  type LucideIcon,
} from "lucide-react";

export type NavPlacement = "header" | "bottom" | "drawer";
export type NavGroup = "discover" | "play" | "you" | "meta" | "curator";

export const NAV_ITEMS: readonly {
  id: TabType;
  path:
    | "/"
    | "/map"
    | "/saved"
    | "/sport-events"
    | "/games"
    | "/support"
    | "/admin"
    | "/admin/curation"
    | "/profile"
    | "/tv";
  label: string;
  shortLabel: string;
  drawerLabel: string;
  Icon: LucideIcon;
  adminOnly?: boolean;
  curationOnly?: boolean;
  authOnly?: boolean;
  placements: readonly NavPlacement[];
  group: NavGroup;
}[] = [
  {
    id: "map",
    path: "/map",
    label: "Spots Map",
    shortLabel: "Spots Map",
    drawerLabel: "Spots Map",
    Icon: MapPinned,
    placements: ["header", "bottom", "drawer"],
    group: "discover",
  },
  {
    id: "games",
    path: "/games",
    label: "League",
    shortLabel: "League",
    drawerLabel: "League",
    Icon: Trophy,
    placements: ["header", "bottom", "drawer"],
    group: "discover",
  },

  {
    id: "saved",
    path: "/saved",
    label: "Saved",
    shortLabel: "Saved",
    drawerLabel: "Saved",
    Icon: Heart,
    authOnly: true,
    placements: ["header", "drawer"],
    group: "you",
  },
  {
    id: "profile",
    path: "/profile",
    label: "Profile",
    shortLabel: "Rider",
    drawerLabel: "Profile",
    Icon: UserCircle,
    authOnly: true,
    placements: ["header", "bottom", "drawer"],
    group: "you",
  },
  {
    id: "tv",
    path: "/tv",
    label: "TV",
    shortLabel: "TV",
    drawerLabel: "TV",
    Icon: Tv,
    placements: ["header", "bottom", "drawer"],
    group: "discover",
  },
  //   {
  //     id: "support",
  //     path: "/support",
  //     label: "Support",
  //     shortLabel: "Support",
  //     drawerLabel: "Support",
  //     Icon: CircleDollarSign,
  //     placements: ["drawer"],
  //     group: "meta",
  //   },
  {
    id: "admin",
    path: "/admin/curation",
    label: "Curation",
    shortLabel: "Curate",
    drawerLabel: "Curation",
    Icon: ClipboardList,
    adminOnly: true,
    curationOnly: true,
    placements: ["drawer"],
    group: "meta",
  },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export const ROUTES = {
  home: "/",
  login: "/login",
  explore: "/explore",
  map: "/map",
  events: "/sport-events",
  games: "/games",
  support: "/support",
  saved: "/saved",
  profile: "/profile",
  spot: (id: string) => `/spots/${id}`,
  spotsNew: "/spots/new",
  tv: "/tv",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export function isActivePath(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}
