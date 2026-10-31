# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the canonical guide, shared with other coding agents, and is imported below. Detailed explanations live in `docs/`. Update those files rather than adding rules here.

@AGENTS.md

## Supabase egress gate

Before finishing any change that touches DB reads or writes, caching, layouts, API routes, polling or realtime, migrations, auth, storage, scripts, or MCP/agent config, run `/supabase_egress_bestpractices` (`.claude/commands/supabase_egress_bestpractices.md`) on the diff and resolve any blockers.
