import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { CartView, type CheckoutShopper } from "@/app/[tenant]/cart/cart-view";
import { Breadcrumbs, Container, Text } from "@/design-system";
import {
  fetchShop,
  fetchShopLive,
  fetchShopperSession,
  isUnauthorized,
  type ShopperSession,
} from "@/lib/erp";
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
 *
 * `requireSignIn` is read live, never from the layout's hour-cached tenant: a
 * stale "on" bounces guests to sign-in on a shop that has reopened guest
 * checkout, and a stale "off" offers them a checkout the ERP will refuse. With
 * a live session no read is needed — a signed-in shopper may check out either
 * way. Without one, `fetchShopLive` makes one uncached read; see there for why
 * `no-store` rather than a short revalidate. The layout itself stays free of
 * request-time reads.
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

  // A live read's `null` (a shop closed since the layout's cached answer) falls
  // back to that answer rather than opening a second not-found path here — the
  // layout decides whether this shop exists, and the ERP refuses the order.
  const requireSignIn = session
    ? false
    : ((await fetchShopLive(tenant))?.requireSignIn ?? shop.requireSignIn);

  // Outside the `try`: `redirect` works by throwing, and a catch around it
  // would swallow the navigation. The cookie is left for the next route handler
  // to clear — a page cannot write one while it renders.
  if (requireSignIn) redirect(signIn);

  return (
    <Container as="main" className="py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Home", href: `/${tenant}` }, { label: "Cart" }]} />
      <Text as="h1" variant="display" className="mt-4">
        Your cart
      </Text>

      <CartView
        tenant={tenant}
        shopName={shop.name}
        shopper={session ? checkoutShopper(session) : null}
        signInHref={signIn}
      />
    </Container>
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
    phone: session.shopper.phone ?? null,
    email: session.shopper.email ?? null,
    address: session.shopper.address ?? null,
    landmark: session.shopper.landmark ?? null,
  };
}
