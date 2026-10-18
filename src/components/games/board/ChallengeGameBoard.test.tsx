import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ChallengeGameBoard } from "./ChallengeGameBoard"
import type { GameState } from "@/lib/schemas/game"

const game = {
  mode: "challenge",
  status: "active",
  stageLedger: [{
    id: "round-1",
    sequence: 1,
    status: "collecting_results",
    challengerPlayerId: "player-1",
    spotType: "rails",
    trickId: "trick-1",
    trickName: "BS Boardslide",
    trickLevel: 2,
    challengerResult: "landed",
    challengeOutcome: "established",
    leadRetained: false,
    attempts: [{ playerId: "player-2", result: "landed" }],
    scores: [{ playerId: "player-1", points: 13, eventTypes: ["challenger_landed"] }],
  }],
  currentRound: {
    id: "round-1",
    sequence: 1,
    trickDescription: "Slide the board across the rail.",
  },
  viewerPlayerId: "player-1",
  viewerPoints: 13,
  winnerBonus: null,
  availableSpotTypes: [{ slug: "rails", name: "Rails", sortOrder: 1 }],
  players: [
    { id: "player-1", displayName: "Rider", letters: "", status: "active" },
    { id: "player-2", displayName: "Guest", letters: "B", status: "active" },
  ],
  wordLength: 4,
  eliminationWord: "BIKE",
  winnerPlayerId: null,
} as GameState

describe("ChallengeGameBoard", () => {
  it("renders the accessible board heading, compact stage route, and rider tracks", async () => {
    const user = userEvent.setup()
    render(<ChallengeGameBoard game={game} />)

    expect(screen.getByRole("heading", { name: "Current Trick" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Session Stages" })).toBeInTheDocument()
    expect(screen.getByRole("listitem", { current: "step" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "BS Boardslide" })).toHaveClass("text-primary")
    const helpButton = screen.getByRole("button", { name: "How To Do BS Boardslide" })
    expect(helpButton).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Slide the board across the rail.")).not.toBeInTheDocument()
    // Copy evolved in ab36b1d: the current-stage "go" cue is now the pulse
    // dot + aria-current asserted above (the tier-1 CTA lives in the shell,
    // not the board; the "Your Turn — Go!" label is model-only).
    expect(screen.queryByText("Rails")).not.toBeInTheDocument()
    expect(screen.queryByText("Intermediate")).not.toBeInTheDocument()
    expect(screen.queryByText("Awaiting the next line")).not.toBeInTheDocument()
    expect(screen.getByText("+13 pts")).toBeInTheDocument()
    expect(screen.getByText("13 Pts · Your Total")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Crew Board" })).toBeInTheDocument()
    expect(screen.getByLabelText("Rider elimination progress")).toBeInTheDocument()
    expect(screen.getByTestId("challenge-rider-tracks-sheet")).toBeInTheDocument()

    await user.click(helpButton)

    const dialog = await screen.findByRole("dialog", {
      name: "How To Do BS Boardslide",
    })
    expect(within(dialog).getByText("Slide the board across the rail.")).toBeInTheDocument()
    expect(helpButton).toHaveAttribute("aria-expanded", "true")

    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "How To Do BS Boardslide" }),
      ).not.toBeInTheDocument(),
    )
    expect(helpButton).toHaveFocus()
  })

  it("keeps training routes free of challenge points", () => {
    render(<ChallengeGameBoard game={{ ...game, mode: "training", viewerPoints: null }} />)

    expect(screen.queryByText("+13 pts")).not.toBeInTheDocument()
    expect(screen.queryByText("13 pts / account total")).not.toBeInTheDocument()
  })

  it("presents solo training without responses or rider tracks", () => {
    render(
      <ChallengeGameBoard
        game={{
          ...game,
          mode: "training",
          trainingVariant: "solo",
          viewerPoints: null,
          players: [{ id: "player-1", userId: null, displayName: "Rider", seatOrder: 0, letters: "", failedAttempts: 0, status: "active" }],
        }}
      />,
    )

    expect(screen.getByRole("list", { name: "Your Run" })).toBeInTheDocument()
    expect(screen.queryByText("Responses")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Crew Board" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("challenge-rider-tracks-sheet")).not.toBeInTheDocument()
    expect(screen.queryByText("Free Ride — Keep Going Until You Finish Your Run")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Rider elimination progress")).not.toBeInTheDocument()
  })

  it("uses color rather than layout changes to mark the current trick", () => {
    const currentStage = game.stageLedger[0]!
    const completedStage = {
      ...currentStage,
      id: "round-0",
      sequence: 0,
      status: "resolved" as const,
      trickName: "Ollie",
    }

    render(
      <ChallengeGameBoard
        game={{ ...game, stageLedger: [completedStage, currentStage] }}
      />,
    )

    expect(screen.getByRole("heading", { name: "BS Boardslide" })).toHaveClass("text-primary")
    expect(screen.getByRole("heading", { name: "Ollie" })).toHaveClass("text-on-surface")
    expect(screen.getByRole("listitem", { current: "step" })).not.toHaveClass("bg-surface-container-low")
    // Completed landed round: green status node + sr-only outcome for screen readers
    expect(screen.getByText("Landed")).toHaveClass("sr-only")
    expect(
      screen.getByRole("list", { name: "Session Stages" }).querySelector(".bg-permission-granted"),
    ).toBeInTheDocument()
  })

  it("marks failed rounds with the error-toned node", () => {
    const failedStage = {
      ...game.stageLedger[0]!,
      id: "round-fail",
      sequence: 9,
      status: "resolved" as const,
      trickName: "Kickflip Out",
      challengerResult: "failed" as const,
      challengeOutcome: "failed_to_establish" as const,
      scores: [],
    }

    render(
      <ChallengeGameBoard
        game={{ ...game, stageLedger: [failedStage], currentRound: null }}
      />,
    )

    expect(screen.getByText("Missed")).toHaveClass("sr-only")
    expect(screen.queryByText("Landed")).not.toBeInTheDocument()
    const failedNode = screen
      .getByRole("list", { name: "Session Stages" })
      .querySelector(".bg-error")
    expect(failedNode).toBeInTheDocument()
    expect(failedNode).toHaveClass("text-on-error")
    expect(failedNode?.querySelector("svg.lucide-x")).toBeInTheDocument()
  })

  it("renders the waiting stage variant before the first round", () => {
    render(
      <ChallengeGameBoard
        game={{ ...game, stageLedger: [], currentRound: null, status: "lobby" }}
      />,
    )

    expect(screen.getByText("Get Ready")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Your First Trick Drops When You Start" })).toBeInTheDocument()
  })

  it("renders inline turn actions on the current stage row when provided", async () => {
    const user = userEvent.setup()
    const selected: Array<"landed" | "failed"> = []
    render(
      <ChallengeGameBoard
        game={game}
        resultAction={{
          label: "How'd It Go?",
          onSelect: (result) => selected.push(result),
        }}
      />,
    )

    const currentItem = screen.getByRole("listitem", { current: "step" })
    await user.click(within(currentItem).getByRole("button", { name: "Landed" }))
    await user.click(within(currentItem).getByRole("button", { name: "Failed" }))

    expect(selected).toEqual(["landed", "failed"])
  })
})
