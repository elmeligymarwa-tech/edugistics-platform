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

## Test suite writes to the production database

`npm run test` runs against the same Supabase database that production reads from — there is no separate test database (a deliberate decision; see the `feature/mailing-list` branch history for the trade-offs considered). `DATABASE_URL` is loaded automatically by `@prisma/client` from `.env` the moment any test imports the training app's Prisma client, independently of Vitest's own config.

Most training-app test files clean up the rows they create in `afterAll`, but that cleanup only runs if the process exits normally — an interrupted run (Ctrl+C, a crashed worker, a lost connection to the remote pooler) skips it and leaves real rows behind. `src/lib/training/analytics.test.ts` in particular seeds courses with `isActive:true, archivedAt:null` — the exact conditions the public `/training` page uses to decide what a visitor sees — so an interrupted run there can leave fixture courses publicly visible on the live site.

**Never run the test suite while teachers or the public can reach edugistics.online/training.** Run it only when you can personally verify the site immediately afterwards, and never leave a run unattended or interrupt it partway through.

`vitest.global-teardown.ts` sweeps every test-marked row from the database before the suite starts and again after every file finishes — a backstop for an interrupted run, or a per-test timeout whose in-flight write lands after that file's own `afterAll` already ran. It only ever deletes a row that matches one of the explicit markers below; it never uses a heuristic (no "contains test", no recency, no `isActive`) that could touch real data.

**Convention every new test file that writes to the training database must follow, so the sweep actually catches it:**
- Define `const MARKER = '<kebab-case-name>-test'` at the top of the file, unique to that file.
- Use that `MARKER` as a literal prefix for every `Course.slug`, `School.canonicalName`, and `PromoCode.description` the file creates.
- Use `@test.local` as the email domain for every `Teacher`/`Subscriber` the file creates.
- Add the new `MARKER` string to the `FILE_MARKERS` array in `vitest.global-teardown.ts`.

A test file that doesn't follow this convention can still clean up correctly on a normal run via its own `afterAll` — but its rows will not be caught by the global sweep if that run is interrupted or races a timeout, meaning a leak from that file could reach production and go unswept indefinitely.
