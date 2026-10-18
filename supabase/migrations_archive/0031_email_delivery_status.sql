-- Email delivery status probe (0031) — feature detection for the UI.
-- league_email_delivery_available() reports boolean presence of a usable
-- resend_api_key in Vault. Boolean only — the secret value is never exposed.
-- Dev databases without the Vault extension resolve to false. The app hides
-- the email-digest toggle while this returns false; no other behavior
-- changes (the sweep already no-ops without the key — see 0030).
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "league_email_delivery_available"()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET "search_path" = public, vault
AS $$
DECLARE
  api_key text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN false;
  END IF;
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  RETURN api_key IS NOT NULL AND api_key <> '';
END;
$$;
--> statement-breakpoint
