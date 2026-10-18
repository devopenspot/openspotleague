import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSessionMock = vi.fn();
const getClaimsMock = vi.fn();
const ensureProfileRowMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSessionMock(...args),
      getClaims: (...args: unknown[]) => getClaimsMock(...args),
    },
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  ensureProfileRow: (...args: unknown[]) => ensureProfileRowMock(...args),
  userFromClaims: () => ({
    id: "user-1",
    name: "Rider",
    email: "rider@example.com",
    initials: "R",
    avatarUrl: null,
     canAccessAdmin: false,
     canCurate: false,
     isAdministrator: false,
  }),
}));

vi.mock("@/lib/auth/server", () => ({
  sanitizeNext: (value: unknown) => typeof value === "string" && value.startsWith("/") ? value : "/",
}));

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  exchangeCodeForSessionMock.mockResolvedValue({ error: null });
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
  ensureProfileRowMock.mockResolvedValue(undefined);
});

describe("GET /auth/callback", () => {
  it("preserves the intended destination when OAuth fails", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/auth/callback?error=access_denied&next=/map?saved=1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?error=oauth&next=%2Fmap%3Fsaved%3D1",
    );
  });

  it("redirects after the session and profile are established", async () => {
    const response = await GET(new NextRequest("http://localhost/auth/callback?code=test&next=/map"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/map");
    expect(ensureProfileRowMock).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }));
  });

  it("does not turn profile provisioning failure into an auth failure", async () => {
    ensureProfileRowMock.mockRejectedValue(new Error("Profile provisioning failed"));

    const response = await GET(new NextRequest("http://localhost/auth/callback?code=test&next=/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
