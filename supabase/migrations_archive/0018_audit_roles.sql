-- Phase 6: tamper-evident audit
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  action text not null check(action in ('replace_roles','replace_country_scopes','replace_discipline_scopes')),
  before jsonb not null,
  after jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_target_idx on admin_audit_log(target_user_id);
create index if not exists admin_audit_log_actor_idx on admin_audit_log(actor_id);

-- append-only: revoke update/delete from authenticated and service_role (least privilege)
-- service_role can still insert/select via RLS bypass but not mutate
revoke update, delete on content_audit_log from authenticated;
revoke update, delete on admin_audit_log from authenticated;
-- service_role revoke requires via role; do not break postgres superuser apply (conditional)
do $$ begin
  revoke update, delete on content_audit_log from service_role;
  revoke update, delete on admin_audit_log from service_role;
exception when others then null;
end $$;

-- trigger prevents mutation even if grant remains
create or replace function prevent_audit_mutation() returns trigger as $$
begin raise exception 'audit log is append-only'; return null; end; $$ language plpgsql;
drop trigger if exists content_audit_immutable on content_audit_log;
create trigger content_audit_immutable before update or delete on content_audit_log for each row execute function prevent_audit_mutation();
drop trigger if exists admin_audit_immutable on admin_audit_log;
create trigger admin_audit_immutable before update or delete on admin_audit_log for each row execute function prevent_audit_mutation();
