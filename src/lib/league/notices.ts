/**
 * Payment-gate notice copy — shared by the service payloads and the UI
 * banner so the announcement text never drifts.
 */

import type { PaymentGate } from "./engine";

export interface PaymentGateNotice {
  title: string;
  message: string;
}

export function paymentNotice(gate: PaymentGate): PaymentGateNotice | null {
  if (gate.state === "settled") return null;
  if (gate.state === "pending") {
    return {
      title: "Payment required to move forward",
      message: `Register this event's plan payment before ${gate.paymentDueAt?.toUTCString() ?? "the deadline"} or the event becomes read-only.`,
    };
  }
  if (gate.state === "locked") {
    return {
      title: "Payment required to move forward",
      message:
        "The event is read-only until a payment is registered. It will be disabled definitively if no payment is registered in time.",
    };
  }
  return {
    title: "Event disabled",
    message:
      "This event was disabled definitively because no payment was registered in time.",
  };
}
