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
