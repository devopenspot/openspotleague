import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import NotificationsTab from "./NotificationsTab"

const setCategory = vi.fn(async () => undefined)
const prefs = {
  preferences: { contest_updates: true, reminders: false, judging: true, results: true, suppressed: false },
  deliveryAvailable: true as boolean | null,
  saving: false,
  saveError: null,
  setCategory,
}

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => ({ id: "u1", email: "rider@example.com" }),
}))
vi.mock("@/hooks/data/useNotifications", () => ({
  useNotificationList: () => ({
    items: [],
    unreadCount: 0,
    loading: false,
    hasMore: false,
    loadMore: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
  useEmailPreferences: () => prefs,
}))

describe("NotificationsTab email preferences", () => {
  beforeEach(() => {
    setCategory.mockClear()
    prefs.deliveryAvailable = true
    prefs.preferences = { contest_updates: true, reminders: false, judging: true, results: true, suppressed: false }
  })

  it("shows the address and a visible hint for every category", () => {
    render(<NotificationsTab />)
    expect(screen.getByText("rider@example.com")).toBeInTheDocument()
    const reminders = screen.getByRole("button", { name: "Reminders" })
    expect(reminders).toHaveAttribute("aria-pressed", "false")
    expect(reminders).toHaveAccessibleDescription("Deadlines, pending scores and payments")
    expect(screen.getByRole("button", { name: "Contest updates" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("New videos to score, scoring complete")).toBeVisible()
  })

  it("toggles a category", async () => {
    render(<NotificationsTab />)
    await userEvent.click(screen.getByRole("button", { name: "Reminders" }))
    expect(setCategory).toHaveBeenCalledWith("reminders", true)
  })

  it("shows every category off while the address is suppressed", () => {
    prefs.preferences = { ...prefs.preferences, suppressed: true }
    render(<NotificationsTab />)
    expect(screen.getByText(/Emails are paused/)).toBeInTheDocument()
    for (const button of screen.getAllByRole("button", { pressed: false })) {
      expect(button).toHaveAttribute("aria-pressed", "false")
    }
    expect(screen.queryByRole("button", { pressed: true })).toBeNull()
  })

  it("hides the card while delivery is not configured", () => {
    prefs.deliveryAvailable = false
    render(<NotificationsTab />)
    expect(screen.queryByText("Email me about")).toBeNull()
  })
})
