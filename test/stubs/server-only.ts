// `server-only` exists to break the build when a client component imports a
// server module. Under Vitest there is no client bundle to protect, so the
// module resolves to nothing. See vitest.config.ts.
export {};
