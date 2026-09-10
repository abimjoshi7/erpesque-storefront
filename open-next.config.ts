import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache yet, so `next: { revalidate }` reads are not persisted
// between requests. Add the R2 incremental cache when traffic warrants it.
export default defineCloudflareConfig({});
