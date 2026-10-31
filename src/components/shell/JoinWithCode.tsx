"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Hash } from "lucide-react";
import { DrawerHeader } from "@/components/feedback/DrawerParts";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { resolveJoinPath } from "@/lib/games/join-input";
import { cn } from "@/lib/utils/cn";

const JOIN_GAME_DRAWER_ID = `join-game-drawer`;
const JOIN_GAME_TITLE_ID = `join-game-title`;
const JOIN_GAME_DESCRIPTION_ID = `join-game-description`;

const UI_COPY = {
  joinWithCode: `Join with code`,
  joinEyebrow: `Join a game`,
  joinTitle: `Have a share code?`,
  joinDescription: `Scanning your friend's QR with your phone camera is fastest. Or paste the code or invite link they sent you.`,
  closeJoinGame: `Close join game`,
  enterShareCodeLabel: `Enter a game share code`,
  placeholder: `Share code or invite link`,
  join: `Join`,
  paste: `Paste`,
  emptyShareCodeError: `Enter a share code to join a game.`,
  invalidShareCodeError: `That doesn't look like a game link. Try the share code instead.`,
  pasteFailedError: `Couldn't read your clipboard. Type the code instead.`,
  shareCodeErrorId: `share-code-error`,
} as const;

const UI_TEMPLATES = {
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
    "inline-flex min-h-9 text-[10px] items-center gap-1.5 rounded-full border border-primary-container bg-on-primary px-5 py-2 font-display font-bold uppercase tracking-[0.08em] leading-none text-on-primary-container transition-colors duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim active:bg-primary-fixed-dim active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  games:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px",
};

export function JoinWithCode({
  variant = "landing",
  className,
}: JoinWithCodeProps) {
  const [shareCode, setShareCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(
      () => setCanPaste(Boolean(navigator.clipboard?.readText)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!joinOpen) return;
    // After the drawer's focus trap, which lands on the close button.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [joinOpen]);

  function submitCode(value: string) {
    if (!value.trim()) {
      setJoinError(UI_COPY.emptyShareCodeError);
      return;
    }
    const path = resolveJoinPath(value);
    if (!path) {
      setJoinError(UI_COPY.invalidShareCodeError);
      return;
    }
    setJoinError(null);
    setJoinOpen(false);
    router.push(path);
  }

  async function pasteCode() {
    try {
      const text = await navigator.clipboard.readText();
      setShareCode(text.trim());
      submitCode(text);
    } catch {
      setJoinError(UI_COPY.pasteFailedError);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setJoinOpen(true)}
        aria-expanded={joinOpen}
        aria-controls={JOIN_GAME_DRAWER_ID}
        data-testid={`join-game-trigger`}
        className={cn(VARIANT_TRIGGER_CLASSES[variant], className)}
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
          <DrawerHeader
            eyebrow={UI_COPY.joinEyebrow}
            title={UI_COPY.joinTitle}
            titleId={JOIN_GAME_TITLE_ID}
            closeLabel={UI_COPY.closeJoinGame}
            onClose={() => setJoinOpen(false)}
          >
            <p
              id={JOIN_GAME_DESCRIPTION_ID}
              className={`mt-1.5 text-sm leading-6 text-on-surface-variant`}
            >
              {UI_COPY.joinDescription}
            </p>
          </DrawerHeader>
          <div className={`min-h-0 flex-1 overflow-y-auto p-4`}>
            <form
              className={`flex w-full flex-col gap-3`}
              onSubmit={(event) => {
                event.preventDefault();
                submitCode(shareCode);
              }}
            >
              <label className={`sr-only`} htmlFor={`share-code`}>
                {UI_COPY.enterShareCodeLabel}
              </label>
              <input
                ref={inputRef}
                id={`share-code`}
                type="text"
                value={shareCode}
                onChange={(event) => {
                  setShareCode(event.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder={UI_COPY.placeholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
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
                className={`min-h-12 min-w-0 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-base outline-none placeholder:text-secondary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
              />
              {joinError ? (
                <p
                  id={UI_COPY.shareCodeErrorId}
                  role={`alert`}
                  className={`text-sm font-semibold text-error`}
                >
                  {joinError}
                </p>
              ) : null}
              <div className={`flex gap-3`}>
                {canPaste ? (
                  <button
                    type={`button`}
                    onClick={() => void pasteCode()}
                    className={`inline-flex min-h-16 flex-1 items-center justify-center gap-2 rounded-lg border-[3px] border-on-surface bg-surface-container-lowest px-3 font-display text-base font-bold uppercase tracking-[0.04em] text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px`}
                  >
                    <ClipboardPaste size={20} aria-hidden="true" />
                    {UI_COPY.paste}
                  </button>
                ) : null}
                <button
                  type={`submit`}
                  className={`min-h-16 flex-1 rounded-lg border-2 border-primary bg-primary px-3 font-display text-base font-bold uppercase tracking-[0.04em] text-on-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px`}
                >
                  {UI_COPY.join}
                </button>
              </div>
            </form>
          </div>
        </div>
      </SideDrawer>
    </>
  );
}
