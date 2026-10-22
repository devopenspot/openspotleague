import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/server";
import { log } from "@/lib/utils/log";
import {
  ensurePreferenceProfile,
  getPreferences,
  ProfileNotFoundError,
  updatePreferences,
} from "@/lib/services/profile/preferences";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const user = await requireUser();
    await ensurePreferenceProfile(user);
    return NextResponse.json(await getPreferences(user.id), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      log.warn("api.preferences.get_profile_not_found", { error: error.message });
      return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
    }
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    log.error("api.preferences.get_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    await ensurePreferenceProfile(user);
    const body = await request.json();
    return NextResponse.json(await updatePreferences(user.id, body), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (error instanceof ZodError) {
      log.warn("api.preferences.patch_validation_failed", { errors: error.flatten() });
      return NextResponse.json(
        { error: "Invalid preferences", details: error.flatten() },
        { status: 400 },
      );
    }
    if (error instanceof ProfileNotFoundError) {
      log.warn("api.preferences.patch_profile_not_found", { error: error.message });
      return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
    }
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Profile provisioning")) {
      log.warn("api.preferences.patch_provisioning_failed", { error: error.message });
      return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
    }
    log.error("api.preferences.patch_failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
