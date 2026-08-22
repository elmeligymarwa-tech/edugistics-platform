# Keeping the test database in step

After any change to `prisma/schema.prisma` — including adding a new
migration under `prisma/migrations/` — run:

```
npm run testdb:migrate
```

Applies pending migrations (`prisma migrate deploy`) to whatever
`DATABASE_URL`/`DIRECT_URL` are set in `.env.test`. `migrate deploy` only
applies migrations not yet recorded as applied and never generates a new
one, so it's safe to run repeatedly. It refuses to run unless
`TEST_DATABASE_URL` confirms the target is the test database, and unless
`DATABASE_URL` isn't the production project — the same guard the test suite
itself uses (`vitest.database-guard.ts`).

**Why:** if the test database's schema drifts from `prisma/migrations/`,
tests start failing on missing/mismatched columns that have nothing to do
with the code under test, and that's much harder to diagnose than a
one-line `migrate deploy`.

Then run the full suite against the test database with:

```
npm run testdb:run
```

## Local development must never resolve to production

`.env.local` holds production Supabase credentials — it's what `next
build`/`next start`/Vercel are meant to read (see `.env.local.example`).
Left alone, `next dev` reads it too, since Next.js falls back to
`.env.local` when nothing more specific is set for the current mode. That
means ordinary local development — clicking around the admin, testing a
form, debugging a page — would write to and read from the live database
`edugistics.online/training` serves, with no test-suite-style guard in the
way to catch it (`vitest.database-guard.ts` only runs inside the test
suite's `globalSetup`; nothing enforces it for `next dev`).

Fix: copy `.env.development.local.example` to `.env.development.local` and
fill in the same credentials as `.env.test` (the same dedicated test
project, `paipadncvmjikeedxnth`). Next.js loads `.env.development.local`
*ahead of* `.env.local` whenever `NODE_ENV=development` — which is what
`next dev` runs as — so this makes local dev resolve to the test project
automatically, with no code change. It has no effect on `next
build`/`next start`, or on Vercel, since those run with
`NODE_ENV=production`; `.env.local` remains the one those read, untouched.

`.env.development.local` is gitignored, same as `.env.test` — this is a
one-time, per-machine setup step, not something committed. The admin UI
also carries a `TEST DATABASE`/`UNKNOWN DATABASE` badge (see
`src/lib/training/database-environment.ts`) derived from the resolved
`DATABASE_URL` itself, not from `NODE_ENV`, so a dev server that isn't
actually pointed at the test project shows this at a glance rather than
looking like a clean, ordinary admin.
