-- Trick catalog spot types: flatground / mini-ramp / flybox are referenced by
-- the skateboard trick fixture (src/data/tricks/skateboard.json) and must exist
-- before the per-discipline trick seed can insert compatibility rows
-- (trick_definition_spot_types.spot_type_slug is RESTRICT → spot_types).
insert into spot_types (slug, name, sort_order) values
  ('flatground', 'Flatground', 11),
  ('mini-ramp', 'Mini Ramp', 12),
  ('flybox', 'Flybox', 13)
on conflict (slug) do nothing;
--> statement-breakpoint
