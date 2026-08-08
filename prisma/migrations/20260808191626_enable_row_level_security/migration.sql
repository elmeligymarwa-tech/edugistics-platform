-- Enable Row Level Security on every table in the public schema.
--
-- This is defence in depth, not the primary access control: the
-- application connects through Prisma using the `postgres` role, which
-- carries the BYPASSRLS attribute in this Supabase project (confirmed via
-- `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`), so RLS
-- has no effect on the app's own queries.
--
-- What it does protect against: Supabase automatically exposes every table
-- in the public schema through its PostgREST API to the `anon` and
-- `authenticated` roles. This application never uses that API — it only
-- ever talks to Postgres directly via Prisma — so there is no reason for
-- those roles to see any row. With RLS enabled and zero policies defined,
-- Postgres defaults to denying all access to any role that is not
-- BYPASSRLS, which fully closes that surface for every table below.

ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "School" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Registration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Prisma's own migration bookkeeping table. Not part of the application's
-- domain model, but it lives in the same public schema and would otherwise
-- be reachable through the same PostgREST surface, so it gets the same
-- deny-by-default treatment for completeness.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
