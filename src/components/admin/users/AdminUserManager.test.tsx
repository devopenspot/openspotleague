import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminUserManager } from "./AdminUserManager"

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
const showToast = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => router,
}))

vi.mock("@/hooks/ui/useToast", () => ({
  showToast,
}))

const availableRoles = [
  {
    slug: "admin",
    name: "Administrator",
    description: "Manage users and structural settings.",
  },
  {
    slug: "curator",
    name: "Curator",
    description: "Maintain spots, events, and tricks.",
  },
] as const

function userWithRoles(roles: readonly { slug: string; name: string }[] = []) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    displayName: "Alice Rider",
    email: "alice@example.com",
    createdAt: "2026-08-18T00:22:51.621Z",
    roles: roles.map((role) => ({
      ...role,
      description: `${role.name} access`,
      grantedBy: null,
      createdAt: "2026-08-18T00:22:51.621Z",
    })),
  }
}

function renderManager(
  user = userWithRoles(),
) {
  return render(
    <AdminUserManager
      initialUsers={[user]}
      availableRoles={availableRoles}
      initialNextCursor={null}
      initialQuery=""
      initialRole=""
    />,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url ?? ""
      if (url.includes("/curator-scopes")) {
        return Promise.resolve(new Response(JSON.stringify({ countryCodes: [], disciplineSlugs: [] }), { status: 200 }))
      }
      if (url.includes("/curator-options")) {
        return Promise.resolve(new Response(JSON.stringify({ countries: [], disciplines: [] }), { status: 200 }))
      }
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              slug: "curator",
              name: "Curator",
              description: "Maintain spots, events, and tricks.",
              grantedBy: "admin-1",
              createdAt: "2026-08-18T00:22:51.621Z",
            },
          ]),
          { status: 200 },
        ),
      )
    }),
  )
})

describe("AdminUserManager", () => {
  it("shows account identity and current access", () => {
    renderManager(
      userWithRoles([{ slug: "curator", name: "Curator" }]),
    )

    expect(screen.getByText("Alice Rider")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(
      screen.getByText("Curator", { selector: "span.inline-flex" }),
    ).toBeInTheDocument()
  })

  it("saves an added curator role through the existing role endpoint", async () => {
    const user = userEvent.setup()
    renderManager()

    await user.click(screen.getByRole("button", { name: "Manage access" }))
    await user.click(screen.getByRole("checkbox", { name: /Curator/ }))
    await user.click(screen.getByRole("button", { name: "Save access" }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/users/00000000-0000-0000-0000-000000000001/roles",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ roles: ["curator"] }),
      }),
    ))
    expect(showToast).toHaveBeenCalledWith("Access updated", "success")
  })

  it("requires confirmation before removing an existing role", async () => {
    const user = userEvent.setup()
    renderManager(userWithRoles([{ slug: "curator", name: "Curator" }]))

    await user.click(screen.getByRole("button", { name: "Manage access" }))
    await user.click(screen.getByRole("checkbox", { name: /Curator/ }))
    await user.click(screen.getByRole("button", { name: "Save access" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Confirm access removal")
    // No PUT to /roles should have happened yet (scopes GETs are allowed)
    expect((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/roles")).length).toBe(0)

    await user.click(screen.getByRole("button", { name: "Confirm removal" }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/roles"),
      expect.objectContaining({ body: JSON.stringify({ roles: [] }) }),
    ))
  })

  it("ignores a load-more response after the filter changes", async () => {
    const user = userEvent.setup()
    let resolveFetch: ((response: Response) => void) | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )
    render(
      <AdminUserManager
        initialUsers={[userWithRoles()]}
        availableRoles={availableRoles}
        initialNextCursor="next-page"
        initialQuery=""
        initialRole=""
      />,
    )

    await user.click(screen.getByRole("button", { name: "Load more users" }))
    const search = screen.getByRole("searchbox", { name: "Search accounts" })
    await user.type(search, "bob")

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(
      ((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit)
        .signal,
    ).toHaveProperty("aborted", true)

    resolveFetch?.(
      new Response(
        JSON.stringify({
          items: [
            {
              ...userWithRoles(),
              id: "00000000-0000-0000-0000-000000000002",
              displayName: "Stale User",
            },
          ],
          nextCursor: null,
          availableRoles,
        }),
        { status: 200 },
      ),
    )
    await waitFor(() => expect(screen.queryByText("Stale User")).not.toBeInTheDocument())
  })
})
