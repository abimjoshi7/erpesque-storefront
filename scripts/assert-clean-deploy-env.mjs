// `next build` always loads .env.local. Locally that file points ERP_API_URL at
// 127.0.0.1 and holds the Rust origin key, neither of which may reach the
// production Worker — so a deploy only runs from a checkout without it.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  console.error(
    "Refusing to deploy: .env.local would be loaded into the production build.\n" +
      "Deploy from a checkout without it (e.g. a git worktree or a fresh clone).",
  );
  process.exit(1);
}
