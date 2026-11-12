# Feature flags

Flags let a big feature merge to `main` in many small pull requests while it stays hidden, then roll out gradually and switch off instantly if something goes wrong. They are **only for big features**. Most work ships without one ([`ci-cd.md`](ci-cd.md#3-big-work-flags-not-long-branches)).

## When to use a flag

Use one when at least one of these is true:

- The work takes several pull requests and changes screens or flows that already exist, so half of it would be visible.
- It needs a staged rollout (admins first, then a percentage of users) or a kill switch in production.
- It changes risky production behaviour: payments, scoring, notifications, anything that writes a lot.

Do **not** use one for bug fixes, small features, refactors, copy or style changes, or new pages nothing links to yet (a dark route is simpler). Do not use flags for configuration (use an env variable) or for product entitlements: League plans and capabilities (`src/lib/league/engine.ts`, `canListPublicly`) are business rules, not flags.

Keep about five flags live at most. Each one doubles the paths to test.

## How a flag works

A flag is declared in code with a default per environment; each environment's database can override it.

```ts
// src/lib/flags/registry.ts  (defineFlag from ./definition)
export const FLAGS = {
  leagueVideoJudging: defineFlag({
    description: "Video judging for League contests",
    owner: "devopenspot",
    removeBy: "2027-02-01",
    defaults: { local: true, develop: true, production: false },
  }),
} as const
```

Evaluation order for `isEnabled(key, { userId, roles })`:

1. No override row in `feature_flags` → the default for `APP_ENV`.
2. Override `enabled = false` → off for everyone (the kill switch).
3. Override `enabled = true` → on for users in `allow_user_ids`, for roles in `allow_roles`, and for `rollout_percent` % of the remaining signed-in users, chosen by a stable hash of user id and flag key (the same user always gets the same answer). Anonymous visitors count only at 100 %.

Each environment has its own database, so turning a flag on in develop never touches production.

### Using a flag

```ts
import { isEnabled, evaluateFlags } from "@/lib/services/flags/feature-flags"

const on = await isEnabled("leagueVideoJudging", { userId: user?.id })
const flags = await evaluateFlags(["leagueVideoJudging", "otherFlag"], { userId: user?.id })
```

Roles are loaded (cached) only when an override targets roles. If the flag table cannot be read, every flag falls back to its code default.

- **Server only.** Call `isEnabled` in Server Components, route handlers and services. Pass the resulting booleans to Client Components; never send the flag table to the browser.
- **One check per entry point.** Check at the top of the page, route or service method, not in every component.
- **Both paths must work.** Tests cover the flag on and off.
- **Database changes still follow expand/contract** ([`ci-cd.md`](ci-cd.md#8-database-migrations-in-the-flow)). A flag hides code, not schema: the migration ships to every environment regardless of the flag.

### Changing a flag

Admins toggle flags in **Admin → Feature flags** (`/admin/flags`) for the environment they are signed in to: code default, on (optionally admins only, or a rollout percentage), or off as a kill switch. The page calls `PUT`/`DELETE /api/admin/flags/<key>`; the API also accepts an allow-list of user ids. A change takes effect within a minute without a deploy: the overrides are read once into the shared cache (`"use cache: remote"`, tag `feature-flags`) and the toggle invalidates that tag after it commits. Each change records who made it and when.

## Lifecycle

| Step | What |
| --- | --- |
| 1. Create | Pull request adds the flag to the registry with an owner and a `removeBy` date (at most three months out), defaults on for `local` and `develop`, off for `production`. |
| 2. Build | Merge the feature in small pull requests behind the flag. Develop shows it, production doesn't. |
| 3. Roll out | Release to production, then in `/admin/flags`: admins only → a percentage → 100 %. |
| 4. Remove | After a release at 100 % with no problems, a pull request deletes the flag and the off path. Then delete the override row. |

`removeBy` is enforced: a unit test fails once a flag is past its date, so CI reminds the owner to finish step 4 (or to push the date with a reason in the pull request).

## Existing flags

`NEXT_PUBLIC_FEATURE_SHORT_LINKS` (`src/lib/config/feature-flags.ts`) and `NEXT_PUBLIC_MAP_DISTANCE` (`src/components/map/shared/map-feature-flags.ts`) are build-time switches from before this system, read in client code. They stay build-time and are set per environment in `.env.develop` and `.env.production`; move one into the registry only if it needs a rollout or a kill switch.

## Code map

| File | Role |
| --- | --- |
| `src/lib/flags/registry.ts` | The declared flags |
| `src/lib/flags/definition.ts`, `evaluate.ts` | Types and the pure evaluation (unit-tested) |
| `src/lib/services/flags/feature-flags.ts` | `isEnabled`, `evaluateFlags`, admin reads and writes, caching |
| `src/lib/repositories/flags/` | `feature_flags` table access (migration `0012_feature_flags.sql`) |
| `src/app/admin/flags`, `src/app/api/admin/flags/[key]` | Admin page and API |

`OPENSPOT_NOTIFICATIONS=1` is not a feature flag: it declares the email secrets on the Worker at deploy time and goes away once those names move into the regular secret list.
