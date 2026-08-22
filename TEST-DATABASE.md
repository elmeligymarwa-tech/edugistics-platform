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
