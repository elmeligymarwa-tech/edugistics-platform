// server-only's real implementation throws unconditionally unless resolved
// with the "react-server" export condition, which only Next.js's server
// build sets. Vitest never sets that condition, so any test that imports a
// module marked `import 'server-only'` needs this no-op stub aliased in
// instead — see vitest.config.mts. Next.js itself still enforces the real
// client/server boundary at build time; this alias only affects `npm test`.
export {}
