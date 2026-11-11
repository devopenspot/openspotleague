import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnvironmentBadge } from "./EnvironmentBadge";

describe("EnvironmentBadge", () => {
  it("shows on develop", () => {
    render(<EnvironmentBadge appEnv="develop" />);
    expect(screen.getByText("Dev")).toBeInTheDocument();
  });

  it("renders nothing on production and locally", () => {
    const { container } = render(<EnvironmentBadge appEnv="production" />);
    expect(container).toBeEmptyDOMElement();
    const local = render(<EnvironmentBadge appEnv="local" />);
    expect(local.container).toBeEmptyDOMElement();
  });
});
