export function statusMessage(status: string): string {
  switch (status) {
    case "granted":
      return "Location ready — opening map.";
    case "denied":
      return "Location access denied — showing global grid.";
    case "unavailable":
      return "Geolocation unavailable in this browser — showing global grid.";
    case "requesting":
      return "Requesting your location…";
    default:
      return "";
  }
}

export const NEARBY_BUTTON_ID = "view-nearby-link";
