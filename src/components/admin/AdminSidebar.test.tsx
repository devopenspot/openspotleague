import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AdminSidebar } from "./AdminSidebar"

const pathname = vi.hoisted(() => ({ value: "/admin/curation" }))
const user = vi.hoisted(() => ({
  value: {
    id: "curator-1",
    name: "Curator",
    email: "curator@example.com",
    initials: "CU",
    avatarUrl: null,
    canAccessAdmin: true,
    canCurate: true,
    isAdministrator: false,
  } as {
    id: string
    name: string
    email: string
    initials: string
    avatarUrl: string | null
    canAccessAdmin: boolean
    canCurate: boolean
    isAdministrator: boolean
  } | null,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}))

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => user.value,
}))

describe("AdminSidebar", () => {
  it("limits curators to curation sections", () => {
    render(<AdminSidebar />)

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Spots" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Tricks" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Sports" })).not.toBeInTheDocument()
  })

  it("adds structural administration sections for administrators", () => {
    user.value = { ...user.value!, canCurate: true, isAdministrator: true }

    render(<AdminSidebar />)

    expect(screen.getByRole("link", { name: "Sports" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Spot types" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Users & roles" })).toBeInTheDocument()
  })

  it("renders no curation navigation for a regular user", () => {
    user.value = { ...user.value!, canAccessAdmin: false, canCurate: false, isAdministrator: false }

    const { container } = render(<AdminSidebar />)

    expect(container).toBeEmptyDOMElement()
  })
})
