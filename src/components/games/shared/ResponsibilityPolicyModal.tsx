"use client";

import Link from "next/link";
import { HardHat, Heart, Phone, ScanEye, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/lib/navigation/nav";
import { GameInfoDialog } from "@/components/games/shared/GameInfoDialog";
import { BODY, controlClass } from "@/components/ui/recipes";

/** Mirrors Terms §02 "Ride at your own risk" (src/lib/legal/terms-content.ts). */
const POINTS: ReadonlyArray<{ icon: LucideIcon; copy: string }> = [
  {
    icon: ScanEye,
    copy: "Check the spot first: surface, traffic, weather, local rules and who's around.",
  },
  {
    icon: HardHat,
    copy: "Wear a helmet and pads, ride within your limits, and bail on anything that feels wrong.",
  },
  {
    icon: Heart,
    copy: "Respect the spot, the locals and everyone sharing it.",
  },
  {
    icon: Phone,
    copy: "In an emergency, call your local emergency number.",
  },
];

export const RISK_WAIVER_HREF = `${ROUTES.terms}#risk-waiver`;

export function ResponsibilityPolicyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <GameInfoDialog
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Before you ride"
      title="Ride at your own risk"
      closeLabel="Close rider policy"
      footer={
        <>
          <Link
            href={RISK_WAIVER_HREF}
            onClick={onClose}
            className={controlClass("secondary")}
          >
            Read the terms
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={controlClass("primary")}
          >
            Got it
          </button>
        </>
      }
    >
      <p className="text-base leading-relaxed text-on-surface">
        OpenSpot keeps score. It doesn&apos;t inspect spots, supervise riders or
        guarantee anyone&apos;s safety.
      </p>
      <ul className="mt-4 space-y-3">
        {POINTS.map(({ icon: Icon, copy }) => (
          <li key={copy} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-container-high text-on-surface"
            >
              <Icon size={16} />
            </span>
            <p className={`pt-1 ${BODY}`}>{copy}</p>
          </li>
        ))}
      </ul>
    </GameInfoDialog>
  );
}
