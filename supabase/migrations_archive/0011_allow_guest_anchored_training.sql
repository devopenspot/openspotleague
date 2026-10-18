-- Allow guest anchored training: remove created_by requirement from training spot branch
-- Scalable: both signed-in and guest must pass 250m + maxAccuracy validation via verifyLocation;
-- verifiedSpots side-effect remains signed-in only (ON CONFLICT DO NOTHING), but game_sessions.spotId is now guest-compatible.

alter table game_sessions drop constraint if exists game_sessions_training_forbids_spot_check;

alter table game_sessions add constraint game_sessions_training_forbids_spot_check
  check (
    mode <> 'training' or (
      (spot_id is null and scheduled_start_at is null and timezone is null
        and location_radius_meters is null and location_max_accuracy_meters is null
        and location_verification_ttl_seconds is null)
      or (spot_id is not null and scheduled_start_at is null and timezone is null
        and location_radius_meters is not null and location_max_accuracy_meters is not null
        and location_verification_ttl_seconds is not null)
    )
  );

-- ensure existing rows still satisfy (guest rows with spot_id were previously rejected by app guard, so no violation)
