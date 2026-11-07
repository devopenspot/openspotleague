import { AlertTriangle, ShieldAlert } from "lucide-react";
import { CARD_NESTED } from "@/components/ui/recipes";
import type { LegalCalloutType } from "@/lib/legal/types";

export interface LegalCalloutProps {
  type: LegalCalloutType;
}

export function LegalCallout({ type }: LegalCalloutProps) {
  if (type === "risk") {
    return (
      <aside
        aria-label="Riding risk warning"
        className="mt-4 rounded-inner border border-accent-start/30 bg-accent-start/5 p-4 text-on-surface sm:p-5"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-accent-start" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-on-surface">
            <strong>You ride at your own risk.</strong> Helmets and pads save lives.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Private property reminder"
      className={`mt-4 text-on-surface ${CARD_NESTED} sm:p-5`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-on-surface" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-on-surface">
          <strong>Respect the spot.</strong> Being on the map is never permission to enter.
        </p>
      </div>
    </aside>
  );
}
