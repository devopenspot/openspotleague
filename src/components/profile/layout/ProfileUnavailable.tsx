import { ProfileShell } from "./ProfileShell";
import { BODY, CARD, CARD_TITLE, controlClass } from "@/components/ui/recipes";
import { ROUTES } from "@/lib/navigation/nav";

/**
 * Shown when the profile summary read fails. A plain link (full reload) is
 * the retry, so this stays a server component with no client JS.
 */
export function ProfileUnavailable() {
  return (
    <ProfileShell>
      <div role="alert" className={`${CARD} mx-auto my-6 max-w-md text-center sm:p-8`}>
        <h1 className={`${CARD_TITLE} text-on-surface`}>Couldn’t load your profile</h1>
        <p className={`mt-1.5 ${BODY}`}>Check your connection and try again.</p>
        <a href={ROUTES.profile} className={`mt-5 ${controlClass("outline")}`}>
          Try again
        </a>
      </div>
    </ProfileShell>
  );
}
