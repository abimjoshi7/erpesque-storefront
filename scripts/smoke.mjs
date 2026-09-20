/**
 * Post-deploy smoke test: does the live shop actually serve a shop?
 *
 * A Worker deploy succeeds the moment the bundle uploads, which says nothing
 * about whether the thing it uploaded can render. Everything this app shows
 * comes from the ERP over a service binding, so the failure that matters —
 * a missing secret, a binding pointing at nothing, an ERP that 500s — looks
 * exactly like a successful deploy until someone opens the page.
 *
 * Checks are deliberately shallow and content-based rather than status-only:
 * `error.tsx` renders with a 200, so a page that says "something went wrong"
 * would pass a status check.
 *
 * Usage: node scripts/smoke.mjs [baseUrl]   (default: SMOKE_BASE_URL or prod)
 */

const base = (
  process.argv[2] ||
  process.env.SMOKE_BASE_URL ||
  "https://shop.ghumtibags.com"
).replace(/\/$/, "");

/** The tenant to probe: any real shop proves the ERP path end to end. */
const tenant = process.env.SMOKE_TENANT || "nsbs";

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;
const TIMEOUT_MS = 20_000;

/** @type {{ name: string, path: string, expect: (res: Response, body: string) => string | null }[]} */
const checks = [
  {
    name: "shop listing",
    path: `/${tenant}`,
    expect: (res, body) => {
      if (res.status !== 200) return `expected 200, got ${res.status}`;
      // At least one product link, which only renders from a live ERP catalog.
      if (!body.includes(`/${tenant}/product/`)) {
        return "page rendered no products — the ERP call likely failed";
      }
      // `error.tsx` renders with a 200, so the status alone proves nothing.
      if (/Something went wrong at our end/i.test(body)) {
        return "page rendered the error boundary";
      }
      return null;
    },
  },
  {
    name: "sitemap",
    path: `/${tenant}/sitemap.xml`,
    expect: (res, body) => {
      if (res.status !== 200) return `expected 200, got ${res.status}`;
      if (!body.includes("<urlset")) return "not a sitemap";
      return null;
    },
  },
  {
    name: "unknown tenant is a 404",
    path: "/definitely-not-a-shop",
    expect: (res) => (res.status === 404 ? null : `expected 404, got ${res.status}`),
  },
];

async function attempt(check) {
  const url = `${base}${check.path}`;
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "erpesque-storefront-smoke" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  return check.expect(res, body);
}

let failed = 0;

for (const check of checks) {
  let problem = "never ran";
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    try {
      problem = await attempt(check);
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    if (problem === null) break;
    // A fresh deploy's first request pays a cold start, and the ERP behind it
    // may still be waking; one slow answer is not a broken shop.
    if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }

  if (problem === null) {
    console.log(`ok    ${check.name}  ${base}${check.path}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${check.name}  ${base}${check.path}\n      ${problem}`);
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} smoke check(s) failed against ${base}.\n` +
      `The deploy is already live. Roll back with:\n` +
      `  npx wrangler rollback --name erpesque-storefront\n`,
  );
  process.exit(1);
}

console.log(`\nAll ${checks.length} smoke checks passed against ${base}.`);
