-- RDS provisioning parity with hosted Supabase: the trusted server-only
-- service_role must bypass row-level security, exactly as it does on Supabase.
-- Without this, direct service_role statements (for example the outbound-email
-- finalize UPDATE) are silently filtered by tenant policies and affect zero
-- rows while the caller reports success. SECURITY DEFINER RPCs are unaffected.
-- Idempotent: re-running is a no-op.
ALTER ROLE service_role BYPASSRLS;
