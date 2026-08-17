"use client";

import { useState } from "react";

import { useCart } from "@/lib/cart";

/**
 * Adds a product to the cart.
 *
 * Takes a slug, not a price. The button has no idea what anything costs, which
 * is what makes the cart untamperable — there is nothing in the browser for an
 * attacker to change that the server would believe.
 */
export function AddToCart({
  tenant,
  slug,
  disabled,
  outOfStock,
}: {
  tenant: string;
  slug: string;
  disabled?: boolean;
  /**
   * Kept apart from `disabled` because the two are different sentences: one
   * says the shop has not finished setting the product up, the other says it
   * has sold out. A shopper can act on the second by coming back.
   */
  outOfStock?: boolean;
}) {
  const { add } = useCart(tenant);
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <p className="mt-8 rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        This item has no price yet, so it cannot be ordered online. Contact the shop.
      </p>
    );
  }

  // Only a convenience. The ERP refuses an out-of-stock line at quote and at
  // order, so hiding this button is what spares the shopper the round trip, not
  // what enforces the rule.
  if (outOfStock) {
    return (
      <p className="mt-8 rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        Out of stock. Check back soon, or contact the shop to ask when it returns.
      </p>
    );
  }

  return (
    <div className="mt-8 flex items-center gap-4">
      <button
        type="button"
        onClick={() => {
          add(slug);
          setAdded(true);
          // The label reverts rather than latching, so adding a second one
          // still reads as an action rather than an already-done state.
          window.setTimeout(() => setAdded(false), 1500);
        }}
        className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Add to cart
      </button>
      <span
        aria-live="polite"
        className="text-sm text-neutral-600 dark:text-neutral-400"
      >
        {added ? "Added" : ""}
      </span>
    </div>
  );
}
