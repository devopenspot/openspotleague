import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
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
      return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
    }
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
    }
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Profile provisioning")) {
      return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Invalid preferences" },
      { status: 400 },
    );
  }
}
