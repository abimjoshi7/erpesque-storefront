import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { CartView, type CheckoutShopper } from "@/app/[tenant]/cart/cart-view";
import { Text } from "@/design-system";
import { fetchShop, fetchShopperSession, isUnauthorized, type ShopperSession } from "@/lib/erp";
import { signInHref } from "@/lib/next-path";
import { readSession } from "@/lib/session";

type PageProps = { params: Promise<{ tenant: string }> };

export const metadata: Metadata = {
  title: "Cart",
  // A cart is per-shopper and worthless in search results.
  robots: { index: false },
};

/**
 * Cart and checkout, and — on a shop that takes orders only from signed-in
 * customers — the place that insists on it.
 *
 * The session is checked with the ERP, not inferred from the cookie being
 * there. A cookie outlives the session behind it often enough (a sign-out on
 * another device, the ERP's absolute cap) that trusting its presence would show
 * a checkout form whose submit is certain to fail. Asking also slides the
 * session's idle window, so a shopper who reaches the cart has the full window
 * to finish.
 *
 * Not the boundary, only the first place a signed-out shopper is turned round:
 * the order route refuses an order with no session, and the ERP refuses one
 * with no live session. This page's job is to make those refusals rare.
 *
 * Reading the cookie makes this page render per request, which it would anyway
 * — nothing on it is the same for two shoppers.
 */
export default async function CartPage({ params }: PageProps) {
  const { tenant } = await params;

  // The layout has already established that this shop is open; this call is
  // deduped against its own and names the shop in the empty-cart copy.
  // `notFound` stays as the type-level floor rather than a second check.
  const shop = await fetchShop(tenant);
  if (!shop) notFound();

  const signIn = signInHref(tenant, `/${tenant}/cart`);
  const token = await readSession(tenant);

  let session: ShopperSession | null = null;
  if (token) {
    try {
      session = await fetchShopperSession(tenant, token);
    } catch (error) {
      // Lapsed or revoked. On a shop that does not require sign-in that simply
      // makes this a guest checkout; one that does is handled just below.
      if (!isUnauthorized(error)) throw error;
    }
  }

  // Outside the `try`: `redirect` works by throwing, and a catch around it
  // would swallow the navigation. The cookie is left for the next route handler
  // to clear — a page cannot write one while it renders.
  if (shop.requireSignIn && !session) redirect(signIn);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Text as="h1" variant="displayMedium" className="mb-8 border-b border-line pb-6">
        Your cart
      </Text>

      <CartView
        tenant={tenant}
        shopName={shop.name}
        shopper={session ? checkoutShopper(session) : null}
        signInHref={signIn}
      />
    </main>
  );
}

/**
 * Only what checkout prefills. The rest of the session — the accounts, the
 * tenant — has no business in a client component's props, which end up in the
 * page's serialised payload.
 */
function checkoutShopper(session: ShopperSession): CheckoutShopper {
  return {
    name: session.shopper.name ?? null,
    phone: session.shopper.phone,
    address: session.shopper.address ?? null,
    landmark: session.shopper.landmark ?? null,
  };
}
