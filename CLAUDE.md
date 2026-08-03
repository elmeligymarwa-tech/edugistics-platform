# Edugistics School Financial Planning Platform

## Non-negotiable rules

- `src/domain/schema.ts` and `src/engine/revenue.ts` are complete and locked. Do not modify them.
- Import all types from `src/domain/schema.ts`. Never redeclare a domain type.
- Never duplicate a calculation from `src/engine/revenue.ts` inside a component.
- Never write TODO or placeholder comments, or mock data.
- All state goes through the Zustand store. Derived values come from selectors, never stored.
- Stack: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Zustand with persist to IndexedDB via idb-keyval, Zod, React Hook Form, Recharts, Framer Motion, Vitest.
- Use British English in all copy.
- Round only at presentation, never inside the engine.
- Before saying a stage is complete, run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`, and report the output.
