# Edugistics School Financial Planning Platform

## Non-negotiable rules

- `src/domain/schema.ts` and `src/engine/revenue.ts` are locked against your own changes — never modify them yourself. The user updates them deliberately and hands you the files. When such a change breaks downstream code, fix the downstream code to match; do not revert the locked files.
- `src/domain/costs.ts` and `src/engine/costs.ts` are complete and locked alongside the V1 files. Do not modify them.
- Import all types from `src/domain/schema.ts`. Never redeclare a domain type.
- Never duplicate a calculation from `src/engine/revenue.ts` inside a component.
- All cost, payroll and statement figures come from `computeCostForecast`. Never recalculate a cost inside a component.
- The cost model is stored separately from the Project, keyed by project id, and persists through the Zustand store the same way.
- Never write TODO or placeholder comments, or mock data.
- All state goes through the Zustand store. Derived values come from selectors, never stored.
- Stack: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Zustand with persist to IndexedDB via idb-keyval, Zod, React Hook Form, Recharts, Framer Motion, Vitest.
- Use British English in all copy.
- Round only at presentation, never inside the engine.
- Before saying a stage is complete, run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`, and report the output.

## The test suite runs against a dedicated test database

The test suite runs against its own Supabase project (ref `paipadncvmjikeedxnth`), separate from the production project (ref `ndkhfqhyuglwtpwlxrxo`) that `edugistics.online/training` reads from. See `TEST-DATABASE.md` for the full setup.

`vitest.database-guard.ts` runs as Vitest's first `globalSetup` step, before any test file loads, and hard-fails the run unless two independent checks both pass: a denylist (`DATABASE_URL` must not reference the production project ref) and an allowlist (`TEST_DATABASE_URL` must be set and byte-for-byte equal to `DATABASE_URL` — a deliberate, explicit opt-in). Neither check can be satisfied by the other, an unrecognised database is treated as unsafe by default, and there is no flag or config option that skips either check.

`npm run testdb:run` is the correct way to run the full suite — it loads `.env.test` explicitly (`node --env-file=.env.test`), which is what actually points `DATABASE_URL`/`TEST_DATABASE_URL` at the test project. Run `npm run testdb:migrate` first after any `prisma/schema.prisma` change, to keep the test database's schema in step with `prisma/migrations/`.

For local development (`next dev`), `.env.development.local` (gitignored, per-machine — copy `.env.development.local.example`) points `DATABASE_URL`/`DIRECT_URL` at the same test project. Next.js loads it ahead of `.env.local` whenever `NODE_ENV=development`, so ordinary local dev — clicking around the admin, testing a form — resolves to the test database automatically, with no code change; `next build`/`next start`/Vercel still resolve through `.env.local` (production) untouched.

The admin UI also carries a `DatabaseEnvironmentBadge` (`src/lib/training/database-environment.ts`, `src/components/training/admin/database-environment-badge.tsx`), derived from the resolved `DATABASE_URL` itself, never from `NODE_ENV`: an amber "TEST DATABASE" badge whenever the app is running against the test project, a red "UNKNOWN DATABASE" badge if `DATABASE_URL` doesn't match either known project ref, and nothing at all on production — so a dev server or deploy that isn't actually pointed where it should be shows this at a glance rather than looking like a clean, ordinary admin.

Most training-app test files clean up the rows they create in `afterAll`, but that cleanup only runs if the process exits normally — an interrupted run (Ctrl+C, a crashed worker, a lost connection to the remote pooler) skips it and leaves fixture rows behind in the test database. That risk didn't disappear when the test database moved off production — it moved with it: local dev (`next dev`, via `.env.development.local`) reads from the same test project, so a killed run can leave phantom courses visible on localhost. `vitest.global-teardown.ts` sweeps every test-marked row from the database before the suite starts and again after every file finishes — a backstop for an interrupted run, or a per-test timeout whose in-flight write lands after that file's own `afterAll` already ran. It only ever deletes a row that matches one of the explicit markers below; it never uses a heuristic (no "contains test", no recency, no `isActive`) that could touch real data.

**Convention every new test file that writes to the training database must follow, so the sweep actually catches it:**
- Define `const MARKER = '<kebab-case-name>-test'` at the top of the file, unique to that file.
- Use that `MARKER` as a literal prefix for every `Course.slug`, `School.canonicalName`, and `PromoCode.description` the file creates.
- Use `@test.local` as the email domain for every `Teacher`/`Subscriber` the file creates.
- Add the new `MARKER` string to the `FILE_MARKERS` array in `vitest.global-teardown.ts`.

A test file that doesn't follow this convention can still clean up correctly on a normal run via its own `afterAll` — but its rows will not be caught by the global sweep if that run is interrupted or races a timeout, leaving stray fixture data in the test database.

## Meta Conversions API deduplication key

Meta deduplicates a Conversions API event against the browser Pixel's event using the pair `event_id` + `event_name` — both must match. `event_source_url` plays no part in deduplication; it's a separate field Meta uses for attribution when `action_source` is `"website"`. Source: Meta's own docs, "Deduplicate Pixel and Server Events" (developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/): *"We determine if events are identical based on their ID and name."* `src/lib/training/meta-capi/send-conversion-event.ts` already relies on this correctly — the shared `eventId` is what dedupes against the Pixel, and `eventSourceUrl` is passed only because Meta requires it for `"website"` events, not because it affects matching.
