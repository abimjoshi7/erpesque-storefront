/**
 * Checks, once at server start, the configuration this app must not run
 * without.
 *
 * Today that is one thing: the Turnstile site key. Checkout and the sign-in
 * code request are both guarded by Cloudflare Turnstile, and the widget that
 * produces the token renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is
 * unset — which is the right behaviour on a laptop and a silent hole in
 * production. A production build without the key ships a checkout with no bot
 * check in front of it, and the only symptom is the ERP refusing every order
 * for want of a token, or, where the ERP has no secret either, no symptom at
 * all. So a production server without the key refuses to start, and says why.
 *
 * `NEXT_PUBLIC_` values are inlined into the bundles when they are built, so
 * the key has to be present at `next build` for the widget to have it. That is
 * also why this runs at server start and not in the build: CI builds this app
 * to prove it compiles, without the key and without meaning to deploy the
 * result. A build is not a deployment; starting a server is.
 *
 * `register` is Next's hook for exactly this — called once per server instance
 * and awaited before the first request is served. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md.
 */
export function register() {
  if (process.env.NODE_ENV !== "production") return;
  // Next can load instrumentation while building, to prerender. Refusing there
  // would fail CI for a key it has no use for.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. Checkout and sign-in are required " +
        "to be behind Cloudflare Turnstile in production; set the site key (paired with " +
        "the ERP's TURNSTILE_SECRET_KEY) and rebuild, since NEXT_PUBLIC_ values are " +
        "inlined at build time.",
    );
  }
}
