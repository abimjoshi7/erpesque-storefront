/**
 * The shop's own public origin.
 *
 * Needed for absolute URLs that leave the page: canonical links, Open Graph
 * images, and the entries in a sitemap. A relative URL is fine in an `href` and
 * useless in all three of those, because whatever consumes them — a crawler, a
 * chat app unfurling a link — has no page to resolve it against.
 *
 * Falls back to localhost so development renders something coherent rather than
 * throwing, but production must set it: a sitemap full of localhost URLs is
 * worse than no sitemap at all.
 */
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return new URL(configured || "http://localhost:3001");
}

/** Absolute URL for a path within this site, for metadata and sitemaps. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}
