import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure modules under `src/lib` — the ones that decide
 * money, URLs and whether a request is ours. Nothing here starts Next or talks
 * to the ERP: the app's own correctness gate for the rendering layer is
 * `next build`, and a live ERP in CI would test the ERP, not this.
 *
 * `server-only` is stubbed because `src/lib/erp.ts` imports it to fail the
 * build when a client component pulls the API key in. That guard is a build
 * concern; under the test runner it is just a module that has no business
 * throwing.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
    },
  },
});
