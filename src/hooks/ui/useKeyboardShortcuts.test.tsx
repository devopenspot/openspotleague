import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useKeyboardShortcuts } from "./useKeyboardShortcuts"

function ShortcutFixture() {
  useKeyboardShortcuts([
    undefined as never,
    { key: "Escape", handler: vi.fn() },
  ])
  return <div />
}

describe("useKeyboardShortcuts", () => {
  it("ignores malformed shortcut entries without crashing the page", () => {
    render(<ShortcutFixture />)
    expect(() => fireEvent.keyDown(window, { key: "Escape" })).not.toThrow()
  })
})
