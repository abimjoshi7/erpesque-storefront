"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useShopper } from "@/components/shopper-provider";
import { Icon } from "@/design-system";
import { signInHref } from "@/lib/next-path";

/** Shared with `CartLink`, so the two sit in the header as one pair. */
export const headerActionClasses =
  "inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-body-sm font-semibold text-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-subdued hover:text-ink-strong";

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
 *
 * On a phone the word is kept for screen readers and only the icon shows, so
 * the header fits one row; it is the same link, not a second one.
 */
export function AccountLink({ tenant }: { tenant: string }) {
  const { session } = useShopper();
  const pathname = usePathname();

  if (session === undefined) return null;

  return session ? (
    <Link href={`/${tenant}/account`} className={headerActionClasses}>
      <Icon name="user" />
      <span className="sr-only sm:not-sr-only sm:max-w-40 sm:truncate">
        {/* Whichever identity the shopper proved — a phone, or for an email
            sign-in the address — when the shop has no name for them yet. */}
        {session.shopper.name ?? session.shopper.phone ?? session.shopper.email ?? "Your orders"}
      </span>
    </Link>
  ) : (
    <Link href={signInHref(tenant, pathname)} className={headerActionClasses}>
      <Icon name="user" />
      <span className="sr-only whitespace-nowrap sm:not-sr-only">Sign in</span>
    </Link>
  );
}
