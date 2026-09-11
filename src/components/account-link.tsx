"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useShopper } from "@/components/shopper-provider";
import { signInHref } from "@/lib/next-path";

/**
 * "Sign in", or the buyer's name once they are.
 *
 * A client component reading the shop's shared shopper state, rather than a
 * server component reading the cookie. Reading a cookie in the shop layout is
 * a request-time API, and it would opt every page beneath `/{tenant}` into
 * per-request rendering — the whole catalog made dynamic to render one link.
 * Decision 0002 spells this out; the cheap version is that the link is not
 * worth the shop's caching.
 *
 * The question itself is asked once, by `ShopperProvider`, and shared with the
 * add to cart button, so a product page does not ask it twice.
 *
 * Rendering nothing until the answer arrives, rather than a "Sign in" that
 * might immediately become a name, keeps the header from flickering between two
 * different words on every navigation.
 *
 * "Sign in" carries the page it was pressed on, so the shopper comes back to
 * it rather than to their order history. The sign-in page vets that path
 * before following it; see `lib/next-path`.
 */
export function AccountLink({ tenant }: { tenant: string }) {
  const { session } = useShopper();
  const pathname = usePathname();

  if (session === undefined) return null;

  return session ? (
    <Link
      href={`/${tenant}/account`}
      className="text-body-sm font-semibold text-ink hover:text-ink-strong"
    >
      {/* Whichever identity the shopper proved — a phone, or for an email
          sign-in the address — when the shop has no name for them yet. */}
      {session.shopper.name ?? session.shopper.phone ?? session.shopper.email ?? "Your orders"}
    </Link>
  ) : (
    <Link
      href={signInHref(tenant, pathname)}
      className="text-body-sm font-semibold text-ink hover:text-ink-strong"
    >
      Sign in
    </Link>
  );
}
