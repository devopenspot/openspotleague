"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Hash, Ticket } from "lucide-react";
import { DrawerHeader, SIDE_DRAWER_PANEL } from "@/components/feedback/DrawerParts";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { BODY, INPUT, controlClass } from "@/components/ui/recipes";
import { resolveEventJoinPath } from "@/lib/sport-events/join-input";
import { cn } from "@/lib/utils/cn";

const JOIN_EVENT_DRAWER_ID = "join-event-drawer";
const JOIN_EVENT_TITLE_ID = "join-event-title";
const JOIN_EVENT_DESCRIPTION_ID = "join-event-description";

const UI_COPY = {
  joinWithCode: "Join with code",
  joinEyebrow: "Join an event",
  joinTitle: "Have an invite code?",
  joinDescription:
    "Paste the invite code or event link an organizer sent you to preview and join the event.",
  closeJoinEvent: "Close join event",
  enterInviteCodeLabel: "Enter an event invite code",
  placeholder: "Invite code or event link",
  join: "Join",
  paste: "Paste",
  emptyInviteCodeError: "Enter an invite code to join an event.",
  invalidInviteCodeError:
    "That doesn't look like an event invite link. Try the invite code instead.",
  pasteFailedError: "Couldn't read your clipboard. Type the code instead.",
  inviteCodeErrorId: "invite-code-error",
} as const;

const UI_TEMPLATES = {
  describedByWithError: (baseId: string, errorId: string) =>
    `${baseId} ${errorId}`,
};

type JoinByCodeVariant = "compact" | "link" | "onWash";

interface JoinByCodeEntryProps {
  variant?: JoinByCodeVariant;
  className?: string;
}

const VARIANT_TRIGGER_CLASSES: Record<JoinByCodeVariant, string> = {
  compact: controlClass("secondary"),
  link: controlClass("outline"),
  onWash: controlClass("onWash"),
};

export function JoinByCodeEntry({
  variant = "compact",
  className,
}: JoinByCodeEntryProps) {
  const [inviteCode, setInviteCode] = useState("");
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
      setJoinError(UI_COPY.emptyInviteCodeError);
      return;
    }
    const path = resolveEventJoinPath(value);
    if (!path) {
      setJoinError(UI_COPY.invalidInviteCodeError);
      return;
    }
    setJoinError(null);
    setJoinOpen(false);
    router.push(path);
  }

  async function pasteCode() {
    try {
      const text = await navigator.clipboard.readText();
      setInviteCode(text.trim());
      submitCode(text);
    } catch {
      setJoinError(UI_COPY.pasteFailedError);
    }
  }

  const TriggerIcon = variant === "link" ? Ticket : Hash;

  return (
    <>
      <button
        type="button"
        onClick={() => setJoinOpen(true)}
        aria-expanded={joinOpen}
        aria-controls={JOIN_EVENT_DRAWER_ID}
        data-testid="join-event-trigger"
        className={cn(VARIANT_TRIGGER_CLASSES[variant], className)}
      >
        <TriggerIcon size={14} aria-hidden="true" />
        {UI_COPY.joinWithCode}
      </button>
      <SideDrawer
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
        labelledBy={JOIN_EVENT_TITLE_ID}
        contentId={JOIN_EVENT_DRAWER_ID}
        testId={JOIN_EVENT_DRAWER_ID}
        side="right"
        panelClassName={SIDE_DRAWER_PANEL}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <DrawerHeader
            eyebrow={UI_COPY.joinEyebrow}
            title={UI_COPY.joinTitle}
            titleId={JOIN_EVENT_TITLE_ID}
            closeLabel={UI_COPY.closeJoinEvent}
            onClose={() => setJoinOpen(false)}
          >
            <p
              id={JOIN_EVENT_DESCRIPTION_ID}
              className={`mt-1.5 ${BODY}`}
            >
              {UI_COPY.joinDescription}
            </p>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <form
              className="flex w-full flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitCode(inviteCode);
              }}
            >
              <label className="sr-only" htmlFor="invite-code">
                {UI_COPY.enterInviteCodeLabel}
              </label>
              <input
                ref={inputRef}
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(event) => {
                  setInviteCode(event.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder={UI_COPY.placeholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={joinError ? "true" : undefined}
                aria-describedby={
                  joinError
                    ? UI_TEMPLATES.describedByWithError(
                        JOIN_EVENT_DESCRIPTION_ID,
                        UI_COPY.inviteCodeErrorId,
                      )
                    : JOIN_EVENT_DESCRIPTION_ID
                }
                className={`${INPUT} font-display tracking-label`}
              />
              {joinError ? (
                <p
                  id={UI_COPY.inviteCodeErrorId}
                  role="alert"
                  className="text-sm font-semibold text-error"
                >
                  {joinError}
                </p>
              ) : null}
              <div className="flex gap-3">
                {canPaste ? (
                  <button
                    type="button"
                    onClick={() => void pasteCode()}
                    className={`flex-1 ${controlClass("outline", "lg")}`}
                  >
                    <ClipboardPaste size={16} aria-hidden="true" />
                    {UI_COPY.paste}
                  </button>
                ) : null}
                <button
                  type="submit"
                  className={`flex-1 ${controlClass("primary", "lg")}`}
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
