"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, X } from "lucide-react";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { cn } from "@/lib/utils/cn";

const JOIN_GAME_DRAWER_ID = `join-game-drawer`;
const JOIN_GAME_TITLE_ID = `join-game-title`;
const JOIN_GAME_DESCRIPTION_ID = `join-game-description`;

const UI_COPY = {
  joinWithCode: `Join with code`,
  joinEyebrow: `Join a game`,
  joinTitle: `Have a share code?`,
  joinDescription: `Enter the code shared by the host to join their live training.`,
  closeJoinGame: `Close join game`,
  enterShareCodeLabel: `Enter a game share code`,
  placeholder: `ENTER SHARE CODE`,
  join: `Join`,
  emptyShareCodeError: `Enter a share code to join a game.`,
  shareCodeErrorId: `share-code-error`,
} as const;

const UI_TEMPLATES = {
  joinPath: (code: string) => `/games/join/${encodeURIComponent(code)}`,
  describedByWithError: (baseId: string, errorId: string) =>
    `${baseId} ${errorId}`,
};

type JoinWithCodeVariant = "landing" | "games";

interface JoinWithCodeProps {
  variant?: JoinWithCodeVariant;
  className?: string;
}

const VARIANT_TRIGGER_CLASSES: Record<JoinWithCodeVariant, string> = {
  landing:
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary-container bg-on-primary px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary-container transition-colors duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim active:bg-primary-fixed-dim active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  games:
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest/95 px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface shadow-[0_4px_16px_rgba(18,18,18,0.08)] backdrop-blur-sm transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px",
};

export function JoinWithCode({
  variant = "landing",
  className,
}: JoinWithCodeProps) {
  const [shareCode, setShareCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setJoinOpen(true)}
        aria-expanded={joinOpen}
        aria-controls={JOIN_GAME_DRAWER_ID}
        data-testid={`join-game-trigger`}
        className={cn(
          VARIANT_TRIGGER_CLASSES[variant],
          className,
          "text-[10px]",
        )}
      >
        <Hash size={14} aria-hidden="true" />
        {UI_COPY.joinWithCode}
      </button>
      <SideDrawer
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
        labelledBy={JOIN_GAME_TITLE_ID}
        contentId={JOIN_GAME_DRAWER_ID}
        testId={JOIN_GAME_DRAWER_ID}
        side={`top`}
        panelClassName={`!top-[4.5rem] !max-h-[calc(100dvh-4.5rem)] border-b border-outline-variant shadow-[0_8px_32px_rgba(18,18,18,0.08)]`}
      >
        <div className={`flex min-h-0 flex-1 flex-col`}>
          <div
            className={`flex items-start justify-between gap-4 border-b border-outline-variant p-5 sm:p-6`}
          >
            <div className={`min-w-0`}>
              <p
                className={`font-display text-[10px] font-semibold uppercase tracking-[0.05em] text-secondary`}
              >
                {UI_COPY.joinEyebrow}
              </p>
              <h2
                id={JOIN_GAME_TITLE_ID}
                className={`mt-2 font-display text-[32px] text-on-surface-variant font-bold uppercase leading-[1.3] tracking-[-0.02em]`}
              >
                {UI_COPY.joinTitle}
              </h2>
              <p
                id={JOIN_GAME_DESCRIPTION_ID}
                className={`mt-2 max-w-2xl text-[10px] leading-6 text-on-surface-variant`}
              >
                {UI_COPY.joinDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJoinOpen(false)}
              aria-label={UI_COPY.closeJoinGame}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-outline-variant bg-surface-container-high text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6`}>
            <form
              className={`flex w-full max-w-2xl items-center gap-2 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-2`}
              onSubmit={(event) => {
                event.preventDefault();
                const code = shareCode.trim();
                if (!code) {
                  setJoinError(UI_COPY.emptyShareCodeError);
                  return;
                }
                setJoinError(null);
                setJoinOpen(false);
                router.push(UI_TEMPLATES.joinPath(code));
              }}
            >
              <label className={`sr-only`} htmlFor={`share-code`}>
                {UI_COPY.enterShareCodeLabel}
              </label>
              <input
                id={`share-code`}
                type="text"
                value={shareCode}
                onChange={(event) => {
                  setShareCode(event.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder={UI_COPY.placeholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={joinError ? `true` : undefined}
                aria-describedby={
                  joinError
                    ? UI_TEMPLATES.describedByWithError(
                        JOIN_GAME_DESCRIPTION_ID,
                        UI_COPY.shareCodeErrorId,
                      )
                    : JOIN_GAME_DESCRIPTION_ID
                }
                className={`min-h-11 min-w-0 flex-1 bg-transparent px-3 font-display text-base uppercase tracking-widest outline-none placeholder:text-secondary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-[10px]`}
              />
              <button
                type={`submit`}
                className={`min-h-11 shrink-0 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-[10px] font-bold uppercase tracking-widest text-on-surface transition-[background-color,transform] hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px`}
              >
                {UI_COPY.join}
              </button>
            </form>
            {joinError ? (
              <p
                id={UI_COPY.shareCodeErrorId}
                role={`alert`}
                className={`mt-2 max-w-2xl text-[10px] text-error`}
              >
                {joinError}
              </p>
            ) : null}
          </div>
        </div>
      </SideDrawer>
    </>
  );
}
