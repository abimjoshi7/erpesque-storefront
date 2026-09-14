import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { ButtonLink, Card, Container, Icon, Notice, Text } from "@/design-system";
import { fetchShopLive, fetchShopperSession, isUnauthorized } from "@/lib/erp";
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
 *
 * How a code is sent is the shop's `signInWith` — email today, SMS when a
 * provider lands. When it is empty the server cannot deliver a code at all, and
 * the page says so plainly rather than offering a form whose first step is
 * certain to fail. On a shop that also requires sign-in, that is a shop that
 * cannot take orders, and the copy is written for the merchant as much as for
 * the shopper.
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

  // Live rather than the layout's hour-old tenant: `signInWith` is what decides
  // whether a form is drawn at all, and a sender the ERP gained or lost should
  // show here on the next visit, not an hour later. The page is per-request
  // already, so there is no cache for this to spoil.
  const shop = await fetchShopLive(tenant);
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
  const channels = shop.signInWith;
  const byEmail = channels.includes("email");

  return (
    <Container as="main" className="py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-ink-strong">
            <Icon name={byEmail ? "mail" : "user"} className="size-6" />
          </span>
          <Text as="h1" variant="displayMedium" className="mt-4">
            Sign in
          </Text>
          <Text variant="bodyLarge" tone="subdued" className="mt-2 text-balance">
            {byEmail
              ? "We will email you a code. There is no password to remember."
              : "We will send a code to your phone. There is no password to remember."}
          </Text>
        </div>

        <Card padding={false} elevation="md" className="mt-8">
          <div className="p-6 sm:p-8">
            {shop.requireSignIn ? (
              <Notice tone="info" className="mb-6">
                {checkingOut
                  ? "Sign in to place your order. Your cart is kept exactly as you left it."
                  : `${shop.name} takes orders from signed-in customers, so every order is tied to an address that has received a code.`}
              </Notice>
            ) : null}

            {channels.length === 0 ? (
              <Notice tone="critical">
                {shop.name} cannot send sign-in codes at the moment, so nobody can sign in
                {shop.requireSignIn ? " — or place an order — " : " "}
                until it can. Please contact the shop directly.
              </Notice>
            ) : (
              <SignInForm tenant={tenant} next={next} channels={channels} />
            )}
          </div>
        </Card>

        {/* Only true of a phone sign-in: a guest order records a phone number
            that was typed, never an email, so signing in by email adopts
            nothing — matching it by phone would hand a guest's history to
            anyone who had typed their number. */}
        {channels.includes("phone") ? (
          <Text variant="caption" tone="muted" className="mt-6 text-center">
            Ordered before as a guest? Sign in with the same phone number and your
            past orders will be here.
          </Text>
        ) : null}

        <div className="mt-6 flex justify-center">
          <ButtonLink href={`/${tenant}`} variant="tertiary" size="sm">
            <Icon name="arrow-left" className="size-4" />
            Back to {shop.name}
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
