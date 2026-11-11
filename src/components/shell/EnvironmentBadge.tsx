import { PUBLIC_APP_ENV } from "@/lib/config/app-env";
import { tagClass } from "@/components/ui/recipes";

/** Marks the develop deployment so nobody mistakes it for production. */
export function EnvironmentBadge({ appEnv = PUBLIC_APP_ENV }: { appEnv?: string }) {
  if (appEnv !== "develop") return null;
  return (
    <span className={tagClass("onWire")} title="Develop environment: test data, not production">
      Dev
    </span>
  );
}
