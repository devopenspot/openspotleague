# CI/CD and delivery flow

How code goes from a branch to `develop` and then to `production`. Environments, secrets and one-time setup are in [`environments.md`](environments.md). Feature flags are in [`feature-flags.md`](feature-flags.md).

> **Rollout status.** This guide describes the target flow; it lands in steps. Live: `ci` on pull requests and `main`. Next: environment-aware build and guards, the develop pipeline, the production release, feature flags, the AWS pipeline. The order and the manual setup are in [`environments.md`](environments.md#one-time-setup). Update this note as each step lands.

The flow in one line: **short branch → pull request with green CI and one review → squash merge to `main` → automatic deploy to develop → manual, approved release of that same commit to production.**

```
feature branch ──PR──► ci (lint · typecheck · test · build · migration rules · infra)
                         │  green + 1 approval → squash merge
                         ▼
main ──push──► ci ──► migrate develop ──► deploy develop ──► smoke develop        automatic
                                                                │
"Release to production" (manual) ─► check: commit is live on develop
        ─► approval (GitHub environment `production`)
        ─► tag vYYYY.MM.DD-N ─► migrate production ─► deploy production ─► smoke ─► GitHub Release
```

## 1. Git strategy: trunk-based

- **`main` is the trunk** and the only long-lived branch. It is always deployable: every commit on it has passed CI and is deployed to develop within minutes.
- **There is no `develop` branch.** "develop" is an environment fed by `main`, not a branch. Do not create `develop`, `staging` or `release` branches.
- **Branches are short.** Name them `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`. A branch lives one to three days. If it would live longer, split the work (section 3).
- **Stay current.** Rebase on `main` (`git pull --rebase origin main`) rather than merging `main` into your branch.
- **Squash merge only.** One pull request becomes one commit on `main`. The pull request title becomes the commit message and the release note, so write it as a [Conventional Commit](https://www.conventionalcommits.org/):

  | Prefix | Use for |
  | --- | --- |
  | `feat(scope): …` | New user-visible behaviour |
  | `fix(scope): …` | Bug fix |
  | `perf`, `refactor`, `chore`, `docs`, `test`, `ci`, `build` | Everything else |
  | `feat(scope)!: …` | A breaking change (rare in a web app; mostly API or URL changes) |

  Scopes follow the code areas: `league`, `games`, `map`, `spots`, `tv`, `profile`, `notifications`, `db`, `infra`, `ci`, `ui`.

### Rules on `main` (GitHub ruleset)

| Rule | Setting |
| --- | --- |
| Pull request before merging | Required, 1 approval, dismiss stale approvals on new pushes, conversations resolved |
| Required status checks | `ci-ok` (it waits for every `ci` job), branch up to date with `main` |
| Merge methods | Squash only; delete the branch after merge |
| History | Linear; no force pushes; no deletion |
| Bypass | Nobody, admins included |

Set these once (see [`environments.md`](environments.md#github)). When the team grows past about five people, turn on the merge queue instead of "branch up to date".

## 2. Pull requests

A good pull request is small (aim for under ~400 changed lines excluding tests and fixtures), does one thing, and leaves `main` releasable.

1. Open it early as a draft if you want feedback.
2. Fill the template (`.github/pull_request_template.md`). It asks the questions that have bitten this project before: is the migration backward-compatible, does this need a flag, did you run the egress audit.
3. CI must be green. Locally, the same gate is `pnpm lint && pnpm typecheck && pnpm test`.
4. One approval from someone other than the author. CODEOWNERS (`.github/CODEOWNERS`) asks the right person for migrations, infra and deploy config.
5. The author merges (squash). Merging means "ship it to develop now".

What CI checks (`.github/workflows/ci.yml`):

| Job | What |
| --- | --- |
| `gate` | `pnpm lint`, `pnpm typecheck`, `pnpm test`, and a DB-free build |
| `migrations` | `pnpm db:check-migrations`: files in `supabase/migrations/` may only be added, never edited, renamed or deleted, and new files take the next number (`src/db/migration-rules.ts`) |
| `infra` | Only when `infra/**` or `src/lib/notifications/delivery/**` changes: `aws:typecheck` and `cdk synth` |
| `pr-title` | The pull request title is a Conventional Commit |
| `ci-ok` | Passes when every job above passed or was skipped. This is the one required check. |

The leftover Vercel check is not part of the flow; remove the integration (see [`environments.md`](environments.md#github)).

## 3. Big work: flags, not long branches

Most work ships directly: a fix, a small feature, a refactor or a copy change goes to production the next time someone releases. Two tools keep bigger work on the trunk without exposing it:

- **Dark route.** New pages or endpoints that nothing links to yet can merge freely. Add the link in the last pull request.
- **Feature flag.** For work that spans several pull requests and changes existing screens, needs a staged rollout, or needs a kill switch. Flags are only for these big features; see [`feature-flags.md`](feature-flags.md) for when, how and the cleanup rule.

Never keep a feature branch open for weeks. A merge conflict against a fast-moving trunk costs more than a flag.

## 4. Environments at a glance

| | Develop | Production |
| --- | --- | --- |
| URL | `dev.openspotleague.com` | `openspotleague.com` |
| Worker | `open-spot-develop` | `open-spot` |
| Database | Supabase develop project | Supabase production project |
| Deployed | Automatically, on every push to `main` | Manually, by the release workflow, after approval |
| Audience | The team; not indexed | Everyone |
| Email | Off (in-app notifications only) | On |

Details, secrets and setup: [`environments.md`](environments.md).

## 5. Deploy to develop (automatic)

`.github/workflows/deploy-develop.yml` runs on every push to `main`. It first runs the whole `ci` workflow on that commit, then deploys, one run at a time: a running deploy is never cancelled, and a newer push replaces one that is still queued, so develop always moves to the newest commit.

1. **Migrate.** `pnpm db:apply` against the develop database.
2. **Build.** `pnpm build:develop` bakes the develop public values into the bundle.
3. **Deploy.** `pnpm deploy:develop` uploads the Worker with the develop secrets, tagged with the commit SHA.
4. **Smoke.** `pnpm smoke develop` (`scripts/smoke.ts`) checks `/api/health`, the home page and the `noindex` header on the Worker's `workers.dev` address, retrying for a minute. (Bot Fight Mode and the WAF block GitHub runners on the custom domain, and no rule can skip Bot Fight Mode.) Share images are checked by hand with `pnpm og:check` when they change ([`og-cards.md`](og-cards.md)).
5. **Record.** A green `deploy-develop` run marks the commit as proven. The release workflow accepts only commits with one.

If a step fails, `main` is still fine to merge into, but the failure is the team's first priority: fix forward with a new pull request, or revert the offending commit (`git revert`, as a pull request).

## 6. Release to production (manual)

Production gets only commits that are already live and checked on develop.

1. Open **Actions → release-production → Run workflow** on `main`. Leave `ref` empty to release the last commit that passed `deploy-develop`, or enter an older SHA from `main`.
2. The `prepare` job checks that the commit is on `main` and has a green `deploy-develop` run, and writes the new migrations and the changes since the last release into the run summary.
3. A reviewer approves the `production` environment (GitHub asks the required reviewers).
4. The `release` job applies migrations to production, builds with the production values, deploys, runs `pnpm smoke production`, then publishes a GitHub Release tagged `vYYYY.MM.DD-N` (UTC date, `N` counts releases that day) with notes generated from the merged pull request titles. Email is included when the `production` environment variable `EMAIL_ENABLED` is `true`.

When to release: whenever develop looks good. Small, frequent releases are safer than big ones; there is no fixed train. Avoid releasing right before you go offline.

### Versioning

Tags are calendar versions, `v2026.11.12-1`. They exist only to name what is in production and to roll back. `APP_VERSION` in `src/lib/config/system-info.ts` is a display string; do not tie it to releases.

## 7. Rollback and hotfix

| Situation | Do |
| --- | --- |
| Production is broken by the last release, now | Cloudflare dashboard → Workers → `open-spot` → Deployments → roll back to the previous version. It takes seconds and touches no data. Then follow up below. |
| Durable rollback | Run **release-production** with the previous tag as `ref` and `rollback` ticked. It redeploys that code, skips migrations and creates no new tag. |
| Bad code, fix is small | Fix forward: a normal pull request, merge, check on develop, release. This is the default. |
| `main` holds unreleased work that must not ship yet and no flag covers it | Rare. Create `hotfix/<tag>` from the production tag, cherry-pick the fix, push, and run **release-production** on that branch (it skips the develop check, so test the fix carefully). Merge the same fix to `main` too. |
| A migration caused it | Migrations are never rolled back. Write a new migration that repairs the state, and release it. Expand/contract (section 8) is what keeps old code working while you do. |

## 8. Database migrations in the flow

The pipeline applies migrations; people do not run `db:apply` against develop or production by hand. The rules:

1. **Forward-only.** Applied migrations are immutable (CI enforces it). Fixes are new files.
2. **Migrate before deploy.** Each environment gets its migrations, then the new code. So between the two steps, and after any code rollback, **the old code runs on the new schema**. Every migration must be backward-compatible with the code that is live in that environment.
3. **Expand / contract for breaking changes.** Split them over releases:

   | Release | Database | Code |
   | --- | --- | --- |
   | 1 (expand) | Add the new column, table or function; keep the old one | Write both, read the old |
   | 2 (migrate) | Backfill | Read the new |
   | 3 (contract) | Drop the old one | Stops referencing it |

   Dropping or renaming something the live code uses (as `0009` did with a function) is the one thing this rule forbids in a single release.
4. **Same files, same order everywhere.** Develop gets a migration when it merges; production gets it on the next release.
5. **Seeds and one-off tasks** run through **Actions → db-task**: `health`, `seed`, `seed-tv`, `seed-tricks`, `bootstrap-admins` (grants admin to the addresses in the `ADMIN_EMAILS` secret; the repository is public, so emails are never typed as inputs), and `fresh-seed` (develop only). Production tasks need the same approval as a release. A nightly `smoke-db` run exercises the League chain on develop.
6. Destructive scripts (`db:reset`, `db:fresh`, `db:fresh:seed`, `storage-gc --delete`) refuse to run against the production project, wherever they are started.

## 9. Infrastructure outside the Worker

- **AWS notifications stack** (`infra/aws`): `cdk diff` runs on pull requests that touch `infra/**`; deploying is a manual workflow for production only, authenticated with GitHub OIDC (no stored AWS keys). Develop has no email stack.
- **Cloudflare dashboard settings** (WAF, Bot Fight Mode, rate limits, Hyperdrive, R2, domains) are not in the repo. Record changes in [`cloudflare-security.md`](cloudflare-security.md) or [`environments.md`](environments.md) in the same pull request that depends on them.

## 10. Who does what

| Task | Who |
| --- | --- |
| Open, review and merge pull requests | Any developer; one approval from someone else |
| Watch the develop deploy after merging | The author of the merged pull request |
| Release to production | Any maintainer; approval by a required reviewer of the `production` environment |
| Roll back | Any maintainer, then tell the team |
| Change secrets, environments, rulesets | Repository owner |
| Remove an expired flag | The flag's owner (CI reminds them) |

## 11. Local work

- `pnpm dev` runs against the develop database through `.env.local` (see [`database.md`](database.md#environment)). Never point a local file at production.
- Before pushing: `pnpm lint && pnpm typecheck && pnpm test`. Before finishing a change that touches database access, caching, routes, polling, auth or scripts, run `/supabase_egress_bestpractices` on the diff.
- Deploying from a laptop is a break-glass action only (`pnpm deploy:develop` or `pnpm deploy:production` with the matching local env file, see [`environments.md`](environments.md#break-glass-deploys-from-a-laptop)). Normal deploys come from the workflows, so that every live commit is on `main` and recorded.
