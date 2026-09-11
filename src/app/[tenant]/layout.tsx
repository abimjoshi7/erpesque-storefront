import { notFound } from "next/navigation";

import { ShopHeader } from "@/components/shop-header";
import { ShopperProvider } from "@/components/shopper-provider";
import { Container, Text } from "@/design-system";
import { fetchShop } from "@/lib/erp";

/**
 * The chrome around one shop.
 *
 * Resolving the tenant here rather than in each page means the shop-exists
 * check happens once for everything under `/{tenant}` — including pages that
 * have no catalog reason to make the call, like the cart, which previously
 * fetched a one-product catalog purely to find out whether the shop was open.
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
 * decision 0002. What it does pass down is the shop's `requireSignIn`, which
 * comes from the `fetchShop` call already made here and costs nothing extra.
 */
export default async function ShopLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const shop = await fetchShop(tenant);
  if (!shop) notFound();

  return (
    <ShopperProvider tenant={tenant} requireSignIn={shop.requireSignIn}>
      <div className="flex min-h-full flex-1 flex-col">
        <ShopHeader tenant={tenant} shopName={shop.name} />
        <div className="flex-1">{children}</div>
        <footer className="mt-16 border-t border-line py-8">
          <Container>
            <Text tone="muted">{shop.name} — payment is on delivery.</Text>
          </Container>
        </footer>
      </div>
    </ShopperProvider>
  );
}
