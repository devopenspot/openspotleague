import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentGateNotice } from "./PaymentGateNotice";
import { addDays, paymentGate } from "@/lib/league/engine";
import { paymentNotice } from "@/lib/league/notices";

const CREATED = new Date("2026-09-01T12:00:00.000Z");

function props(state: "pending" | "locked" | "disabled") {
  const gate = paymentGate({
    origin: "community",
    createdAt: CREATED,
    hasActivePayment: false,
    now:
      state === "pending"
        ? CREATED
        : state === "locked"
          ? addDays(CREATED, 3)
          : addDays(CREATED, 6),
  });
  const notice = paymentNotice(gate)!;
  return {
    state,
    title: notice.title,
    message: notice.message,
    paymentDueAt: gate.paymentDueAt?.toISOString() ?? null,
    paymentDeadlineAt: gate.paymentDeadlineAt?.toISOString() ?? null,
  };
}

describe("PaymentGateNotice", () => {
  it("renders the highlighted announcement while payment is pending", () => {
    render(<PaymentGateNotice {...props("pending")} />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-payment-state",
      "pending",
    );
    expect(
      screen.getByText("Payment required to move forward"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Read-only after/i)).toBeInTheDocument();
    expect(screen.getByText(/Disabled after/i)).toBeInTheDocument();
  });

  it("renders the locked read-only state with the deadline", () => {
    render(<PaymentGateNotice {...props("locked")} />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-payment-state",
      "locked",
    );
    expect(screen.getByText(/read-only until a payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/Read-only after/i)).not.toBeInTheDocument();
  });

  it("renders the disabled state as an alert without the action slot", () => {
    render(
      <PaymentGateNotice {...props("disabled")} action={<button>Pay</button>} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay" })).not.toBeInTheDocument();
  });
});
