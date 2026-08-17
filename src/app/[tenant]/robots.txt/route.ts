import { fetchFacets } from "@/lib/erp";
import { absoluteUrl } from "@/lib/site";

/**
 * Per-shop robots.txt, pointing a crawler at that shop's sitemap.
 *
 * Two paths are closed. `/api/` is this app's own server seam, not content.
 * `/{tenant}/order/` holds the status pages, whose URLs carry the token that
 * authorises them — a crawler that followed one would put a name, phone number
 * and delivery address in a search result. The pages send `noindex` as well;
 * this is the belt to that pair of braces, since only one of the two survives a
 * link being shared into an app that prefetches it.
 *
 * A disabled shop 404s here too, so robots.txt cannot be used to enumerate
 * which tenant codes exist.
 *
 * Uses the facets call purely as an "is this shop open" probe — it is the
 * cheapest storefront read and already cached for an hour.
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

  const open = await fetchFacets(tenant);
  if (!open) {
    return new Response("Not found", { status: 404 });
  }

  const prefix = `/${encodeURIComponent(tenant)}`;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    `Disallow: ${prefix}/order/`,
    `Disallow: ${prefix}/cart`,
    "",
    `Sitemap: ${absoluteUrl(`${prefix}/sitemap.xml`)}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
