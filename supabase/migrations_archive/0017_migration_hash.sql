-- Migration hash tamper detection — add hash column if not already via apply-sql auto-migrate
alter table schema_migrations add column if not exists hash text;
