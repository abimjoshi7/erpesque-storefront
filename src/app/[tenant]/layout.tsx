import { notFound } from "next/navigation";

import { ShopHeader } from "@/components/shop-header";
import { ShopperProvider } from "@/components/shopper-provider";
import { SiteFooter } from "@/components/site-footer";
import { listingHref } from "@/lib/catalog-url";
import { fetchFacets } from "@/lib/erp";

/**
 * The chrome around one shop.
 *
 * Resolving the tenant here rather than in each page means the shop-exists
 * check happens once for everything under `/{tenant}` — including pages that
 * have no catalog reason to make the call, like the cart, which previously
 * fetched a one-product catalog purely to find out whether the shop was open.
 *
 * Read through `fetchFacets` rather than `fetchShop` because the header's
 * categories menu wants the shelves as well as the name, and `fetchShop` is
 * this same request with the categories thrown away. The listing asks for the
 * facets too, and Next dedupes the two within one render.
 *
 * A tenant that does not exist, one that is suspended and one that has not
 * enabled the storefront module all arrive as the same 404, so this page cannot
 * be used to work out which tenant codes are real.
 *
 * Route handlers under this segment — the media proxy, robots.txt, the
 * sitemap — do not render layouts, so none of them pays for this.
 *
 * `ShopperProvider` wraps everything so the header and the add to cart button
 * share one answer to "who is signed in". It is a client component that asks
 * after hydration; this layout itself reads no cookie, and must not — see
 * decision 0002.
 *
 * Nothing here passes down `requireSignIn`. The tenant this layout holds is up
 * to an hour old (it rides the facets cache), which is fine for a name and
 * wrong for a rule a merchant expects to take effect when they flip it. Each
 * place that acts on the flag reads a fresher copy: the product page from its
 * own one-minute read, the cart and sign-in pages live.
 */
export default async function ShopLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const facets = await fetchFacets(tenant);
  if (!facets) notFound();

  const shop = facets.tenant;
  const categories = facets.categories.map((facet) => ({
    value: facet.value,
    href: listingHref(tenant, { category: facet.value }),
    productCount: facet.productCount,
  }));

  return (
    <ShopperProvider tenant={tenant}>
      <div className="flex min-h-full flex-1 flex-col">
        <ShopHeader tenant={tenant} shopName={shop.name} categories={categories} />
        <div className="flex-1">{children}</div>
        <SiteFooter tenant={tenant} shopName={shop.name} currencyCode={shop.currency?.code} />
      </div>
    </ShopperProvider>
  );
}
