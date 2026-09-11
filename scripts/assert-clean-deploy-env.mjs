// `next build` always loads .env.local. Locally that file points ERP_API_URL at
// 127.0.0.1 and holds the Rust origin key, neither of which may reach the
// production Worker — so a deploy only runs from a checkout without it.
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  console.error(
    "Refusing to deploy: .env.local would be loaded into the production build.\n" +
      "Deploy from a checkout without it (e.g. a git worktree or a fresh clone).",
  );
  process.exit(1);
}

// src/instrumentation.ts refuses to start a production server without the
// Turnstile site key, and on Workers that refusal is every request failing.
// NEXT_PUBLIC_ values are inlined at build, so the key has to be in the
// environment or .env.production now — catching it here fails the deploy
// instead of taking the live shop down.
const productionEnv = existsSync(".env.production")
  ? readFileSync(".env.production", "utf8")
  : "";
const siteKeyInFile = /^\s*NEXT_PUBLIC_TURNSTILE_SITE_KEY\s*=\s*\S+/m.test(productionEnv);

if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !siteKeyInFile) {
  console.error(
    "Refusing to deploy: NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set.\n" +
      "Add the Turnstile site key (it is public) to .env.production, paired with the\n" +
      "ERP's TURNSTILE_SECRET_KEY. Without it the Worker refuses every request.",
  );
  process.exit(1);
}
