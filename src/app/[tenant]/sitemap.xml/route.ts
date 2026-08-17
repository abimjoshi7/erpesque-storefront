import { fetchSitemap } from "@/lib/erp";
import { absoluteUrl } from "@/lib/site";

/**
 * One sitemap per shop, at `/{tenant}/sitemap.xml`.
 *
 * Written by hand rather than through Next's `sitemap.ts` convention: that one
 * generates a sitemap per *route file*, and what is wanted here is one per
 * tenant, discovered at request time. A route handler says that directly.
 *
 * The ERP returns slugs and timestamps; the URLs are built here, because this
 * app is the only thing that knows what its own URLs look like.
 *
 * A disabled shop 404s, exactly as its pages do — a sitemap is not a way to
 * find out that a tenant exists but is switched off.
 *
 * Never prerendered. There is no build-time list of tenants — shops are enabled
 * in the ERP, not by a deploy — so a static copy would be a snapshot of
 * whichever tenant happened to be passed a placeholder at build time. The
 * Cache-Control header is what keeps it cheap instead: the edge holds the
 * response for an hour, and the origin is only asked when that lapses.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const result = await fetchSitemap(tenant);

  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  const urls = [
    // The listing page itself, which no product entry would otherwise mention.
    { loc: absoluteUrl(`/${encodeURIComponent(tenant)}`), lastmod: undefined as string | undefined },
    ...result.products.map((entry) => ({
      loc: absoluteUrl(
        `/${encodeURIComponent(tenant)}/product/${encodeURIComponent(entry.slug)}`,
      ),
      lastmod: entry.lastModified ?? undefined,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, lastmod }) =>
      `  <url><loc>${escapeXml(loc)}</loc>${
        lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""
      }</url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Crawlers do not need the hour's news, and this is the one call that
      // reads the whole catalog at once.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

/**
 * Slugs are ERP-generated and URL-safe, so this guards against the unexpected
 * rather than the everyday — but a single stray `&` makes the whole document
 * unparseable, and a crawler reports that as "sitemap could not be read"
 * without saying which line.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
