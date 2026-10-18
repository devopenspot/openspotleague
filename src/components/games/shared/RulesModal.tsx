"use client";

import { X } from "lucide-react";
import { Overlay } from "@/components/feedback/Overlay";

const RULES_TITLE_ID = "rules-dialog-title";

export function RulesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={RULES_TITLE_ID}
      containerClassName="bg-surface-bright"
      panelClassName="max-w-3xl overflow-hidden rounded-[4px] bg-surface-bright"
    >
      <div className="flex items-start justify-between gap-4 border-b border-outline p-6">
        <div>
           <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            How it works
          </p>
          <h2
            id={RULES_TITLE_ID}
            className="mt-2 font-display text-4xl font-bold uppercase leading-none"
          >
            The match
            <br />
            sheet
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rules"
           className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline text-on-surface transition-colors hover:border-primary hover:bg-surface-container"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        <Rule
          number="01"
          title="Verify"
           copy="Ranked riders check in at the registered spot before each round. Casual games skip location checks."
        />
        <Rule
          number="02"
          title="Call it"
          copy="The current leader sets the spot type and level; the game keeps that line between rounds."
        />
        <Rule
          number="03"
          title="Ride"
          copy="The leader goes first. If they land, the other rider gets the same trick."
        />
        <Rule
          number="04"
          title="Track"
           copy="A failed response adds the next letter of your discipline's word. Complete BLADE, SKATE, BIKE or SCOOT and you are out."
        />
      </div>
      <div className="flex justify-end border-t border-outline p-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-12 items-center border border-outline px-6 font-display text-sm font-bold uppercase tracking-[0.12em] text-on-surface hover:bg-surface-container"
        >
          Close
        </button>
      </div>
    </Overlay>
  );
}

function Rule({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="border-t border-outline pt-3">
       <p className="font-display text-xs font-semibold tracking-[0.08em] text-secondary">{number}</p>
      <h3 className="mt-4 font-display text-2xl font-bold uppercase">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{copy}</p>
    </article>
  );
}
