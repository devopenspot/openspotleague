import "./load-env"
import postgres from "postgres"
import { getDirectDatabaseUrl } from "../lib/config/env"
import { getPostgresOptions } from "../lib/db/postgres-options"

const APPLICATION_TABLES = [
  "short_links",
  "user_email_preferences",
  "user_notifications",
  "league_email_log",
  "event_realtime_signals",
  "event_action_requests",
  "event_points_ledger",
  "event_results",
  "event_scores",
  "event_runs",
  "event_scoring_criteria",
  "event_memberships",
  "event_invites",
  "event_payments",
  "user_event_plans",
  "event_disciplines",
  "game_realtime_signals",
  "game_race_laps",
  "challenge_trick_spot_types",
  "challenge_catalog_tricks",
  "challenge_catalogs",
  "trick_catalog_states",
  "content_audit_log",
  "admin_audit_log",
  "trick_definition_spot_types",
  "trick_definitions",
  "rider_score_events",
  "rider_stats",
  "spot_challenge_records",
  "game_location_verifications",
  "game_action_requests",
  "game_attempts",
  "game_rounds",
  "game_players",
  "game_sessions",
  "spot_weather_reports",
  "curator_country_scopes",
  "curator_discipline_scopes",
  "user_roles",
  "role_permissions",
  "permissions",
  "roles",
  "spot_weather_verifications",
  "verified_spots",
  "saved_spots",
  "profiles",
  "spot_type_assignments",
  "spot_disciplines",
  "tv_videos",
  "sport_events",
  "spot_images",
  "community_spot_submissions",
  "spots",
  "event_categories",
  "event_tiers",
  "event_plans",
  "sport_disciplines",
  "spot_types",
  "countries",
  "regions",
] as const

const FUNCTIONS = [
  "public.bump_verification_count()",
  "public.enforce_game_player_letters()",
  "public.emit_game_realtime_signal()",
  "public.emit_event_realtime_signal()",
  "public.enforce_game_session_catalog_definition()",
  "public.enforce_immutable_game_definition()",
  "public.reject_immutable_catalog_mutation()",
  "public.enforce_spot_discipline_presence()",
  "public.enforce_event_discipline_presence()",
  "public.jsonb_is_unique_uuid_array(jsonb)",
  "public.jsonb_is_unique_nonempty_text_array(jsonb)",
  "public.jsonb_is_spot_type_snapshot_array(jsonb)",
  "public.has_permission(text, uuid)",
  "public.has_country_scope(text, uuid)",
  "public.has_discipline_scope(text, uuid)",
  "public.is_game_participant(uuid, uuid)",
  "public.is_round_participant(uuid, uuid)",
  "public.is_event_participant(uuid, uuid)",
  "public.prevent_audit_mutation()",
  "public.league_email_sweep()",
  "public.league_email_delivery_available()",
  "public.league_escape_html(text)",
] as const

async function main() {
  const url = getDirectDatabaseUrl()
  if (!url) throw new Error("SUPABASE_DIRECT_URL is not configured")

  const sql = postgres(url, getPostgresOptions("ddl", { max: 1 }))
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended('openspot:database-reset', 0))`
      await tx`set local statement_timeout = '120s'`

      await tx.unsafe(
        `drop view if exists public.sport_events_with_status cascade`,
      )
      await tx.unsafe(
        `drop table if exists ${APPLICATION_TABLES.map((table) => `public."${table}"`).join(", ")} cascade`,
      )

      for (const functionName of FUNCTIONS) {
        await tx.unsafe(`drop function if exists ${functionName} cascade`)
      }

      // The email cron job would otherwise keep firing `league_email_sweep()`
      // against a function that no longer exists.
      await tx.unsafe(`
        do $$
        begin
          if exists (
            select 1 from pg_namespace n
            join pg_proc p on p.pronamespace = n.oid
            where n.nspname = 'cron' and p.proname = 'unschedule'
          ) then
            perform cron.unschedule('league-email-sweep');
          end if;
        exception when others then
          null;
        end $$;
      `)

      await tx`drop table if exists public.schema_migrations cascade`
    })
    console.log("✓ application database reset; auth and storage data were preserved")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
