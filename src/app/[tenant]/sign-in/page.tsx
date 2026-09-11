import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { Notice, Text } from "@/design-system";
import { fetchShop, fetchShopperSession, isUnauthorized } from "@/lib/erp";
import { safeNext } from "@/lib/next-path";
import { readSession } from "@/lib/session";

import { SignInForm } from "./sign-in-form";

/**
 * Signing in is personal and there is nothing here for a crawler to index — the
 * page is a form and nothing else — so it stays out of search results alongside
 * the order pages.
 */
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * `?next=` is where the shopper was when they were asked to sign in — the cart,
 * or the product they were about to buy. It is vetted by `safeNext` here and
 * vetted again by the form, and anything that is not a path on this shop
 * becomes the account page.
 *
 * A shopper who is already signed in is sent straight on to it. The session is
 * checked with the ERP rather than trusted because a cookie exists: the cart
 * sends a shopper whose session has lapsed to this page, and if this page sent
 * anyone holding a cookie back to the cart, a lapsed cookie would bounce
 * between the two forever.
 */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { tenant } = await params;
  const { next: nextParam } = await searchParams;
  const next = safeNext(tenant, nextParam);

  const shop = await fetchShop(tenant);
  if (!shop) notFound();

  const session = await readSession(tenant);
  let signedIn = false;
  if (session) {
    try {
      signedIn = Boolean(await fetchShopperSession(tenant, session));
    } catch (error) {
      // A lapsed session is the ordinary reason to be here; show the form.
      // Anything else is a real failure and belongs to the error boundary.
      if (!isUnauthorized(error)) throw error;
    }
  }
  // Outside the `try`: `redirect` works by throwing, and a catch around it
  // would swallow the navigation.
  if (signedIn) redirect(next);

  const checkingOut = next === `/${tenant}/cart`;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Text as="h1" variant="displayMedium">
        Sign in
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-2">
        We will send a code to your phone. There is no password to remember.
      </Text>

      {shop.requireSignIn ? (
        <Notice tone="info" className="mt-6">
          {checkingOut
            ? "Sign in to place your order. Your cart is kept exactly as you left it."
            : `${shop.name} takes orders from signed-in customers, so every order is tied to a phone number that has received a code.`}
        </Notice>
      ) : null}

      <SignInForm tenant={tenant} next={next} />

      <Text variant="caption" tone="muted" className="mt-8">
        Ordered before as a guest? Sign in with the same number and your past
        orders will be here.
      </Text>
    </main>
  );
}
