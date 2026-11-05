import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RatedScoreForm } from "./RatedScoreForm";

function raise(label: string, times = 1) {
  for (let index = 0; index < times; index += 1) {
    fireEvent.click(screen.getByRole("button", { name: `Raise ${label}` }));
  }
}

describe("RatedScoreForm", () => {
  it("keeps submit locked until every criterion is set", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<RatedScoreForm discipline="roller" format="park" hasBestTrick={false} onSubmit={onSubmit} />);
    const submit = screen.getByRole("button", { name: "Submit score" });
    expect(submit).toBeDisabled();
    raise("Difficulty");
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Still to score: Style/)).toBeInTheDocument();
    for (const label of ["Style", "Amplitude", "Consistency", "Creativity"]) raise(label);
    expect(submit).toBeEnabled();
  });

  it("sends the five criteria in 0.5 steps, the elements and the best trick", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<RatedScoreForm discipline="roller" format="street" hasBestTrick onSubmit={onSubmit} />);
    for (const label of ["Difficulty", "Style", "Amplitude", "Consistency", "Creativity"]) raise(label);
    raise("Difficulty");
    fireEvent.click(screen.getByLabelText(/Grinds/));
    expect(screen.getByRole("button", { name: "Submit score" })).toBeDisabled();
    raise("Trick difficulty", 3);
    raise("Trick execution");
    fireEvent.click(screen.getByRole("button", { name: "Submit score" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      scores: { difficulty: 5.5, style: 5, amplitude: 5, consistency: 5, creativity: 5 },
      elements: ["grinds"],
      bestTrick: { difficulty: 6, execution: 5 },
    });
  });
});
