"use client";

import Link from "next/link";

import { headerActionClasses } from "@/components/account-link";
import { Icon } from "@/design-system";
import { useCart } from "@/lib/cart";

/**
 * Cart link with a count.
 *
 * The count is empty until after mount because the cart lives in localStorage,
 * which the server cannot see — rendering a number during SSR would guarantee a
 * hydration mismatch on every page load.
 *
 * The badge is drawn for the eye and hidden from screen readers, which get the
 * count as words instead: "Cart, 3 items" rather than "Cart 3", a bare number
 * that could as easily be a price.
 */
export function CartLink({ tenant }: { tenant: string }) {
  const { count } = useCart(tenant);

  return (
    <Link href={`/${tenant}/cart`} className={headerActionClasses}>
      {/* The badge sits off the bag's top-right corner, clear of the handle, and
          the margin keeps it off the "Cart" label. The margin is there with or
          without a count, so the label does not shift when the count arrives
          after mount. */}
      <span className="relative mr-1">
        <Icon name="bag" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-label leading-none font-bold text-on-primary tabular-nums ring-2 ring-surface"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      <span className="sr-only sm:not-sr-only">Cart</span>
      {count > 0 ? (
        <span className="sr-only">
          , {count} {count === 1 ? "item" : "items"}
        </span>
      ) : null}
    </Link>
  );
}
