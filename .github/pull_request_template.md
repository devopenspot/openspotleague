<!-- Title: a Conventional Commit, e.g. `feat(league): video judging queue`. It becomes the squash commit and the release note. -->

## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## How to check it

<!-- What a reviewer should click or run on develop after merge. -->

## Checklist

- [ ] Small and focused; `main` stays releasable after this merges.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally.
- [ ] **Migration** (if any): new numbered file, and it works with the code that is live now (expand/contract, `docs/ci-cd.md` §8).
- [ ] **Big feature?** It sits behind a flag with an owner and `removeBy` date (`docs/feature-flags.md`), or nothing links to it yet.
- [ ] **Config**: new variables are in `src/lib/config/env.ts` and in `.env.develop`/`.env.production` or the secret list (`docs/environments.md`).
- [ ] **Egress**: ran `/supabase_egress_bestpractices` if this touches DB access, caching, routes, polling, realtime, auth, storage or scripts.
- [ ] Docs updated where behaviour changed.
