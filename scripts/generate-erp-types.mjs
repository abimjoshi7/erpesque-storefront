import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regenerates `src/types/erp-api.d.ts` from the ERP's OpenAPI spec.
 *
 * This exists instead of a one-line npm script because the spec lives in
 * another repo, and pointing at the wrong checkout of it is silent and
 * destructive: `openapi-typescript` happily emits a valid file with every
 * storefront type missing, and the breakage only surfaces later as a wall of
 * unrelated type errors. The storefront endpoints live on a feature branch, so
 * a sibling clone parked on any other branch is a spec with none of them in it.
 *
 * The guard below therefore refuses to write anything unless the spec actually
 * documents the routes this app calls.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SPEC = "../erp/server/openapi.yaml";
const OUTPUT = "src/types/erp-api.d.ts";

const specArg = process.env.ERP_OPENAPI?.trim() || DEFAULT_SPEC;
const specPath = resolve(repoRoot, specArg);

function fail(problem, remedy) {
  console.error(`\nERP type generation aborted: ${problem}\n\n${remedy}\n`);
  process.exit(1);
}

if (!existsSync(specPath)) {
  fail(
    `no OpenAPI spec at ${specPath}`,
    `Set ERP_OPENAPI to the spec in your ERP checkout, e.g.\n` +
      `  ERP_OPENAPI=../erp-server/server/openapi.yaml npm run types:generate`,
  );
}

// Paths are quoted in the spec ("/storefront/{tenantCode}/catalog":), so match
// the leading slash rather than the quote, which is a formatting detail.
const spec = readFileSync(specPath, "utf8");
if (!/^\s*"?\/storefront\//m.test(spec)) {
  fail(
    `${specPath} documents no /storefront/ routes`,
    `That checkout is on a branch without the storefront API. Point at one\n` +
      `that has it (the feat/storefront worktree) rather than regenerating:\n` +
      `  ERP_OPENAPI=../erp-server/server/openapi.yaml npm run types:generate\n\n` +
      `Once feat/storefront merges to main, the default path works again.`,
  );
}

execFileSync(
  "npx",
  ["openapi-typescript", specPath, "-o", resolve(repoRoot, OUTPUT)],
  { stdio: "inherit", cwd: repoRoot },
);
