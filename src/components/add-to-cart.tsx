"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Button, ButtonLink, Notice, QuantityStepper, Text } from "@/design-system";
import { useCart } from "@/lib/cart";
import { signInHref } from "@/lib/next-path";

/**
 * Adds a product to the cart.
 *
 * Takes a slug, not a price. The button has no idea what anything costs, which
 * is what makes the cart untamperable — there is nothing in the browser for an
 * attacker to change that the server would believe.
 *
 * On a shop that only takes orders from signed-in customers, a signed-out
 * shopper is offered sign-in instead, and brought back to this page after. The
 * gate is here and not only at checkout because a cart that fills freely and
 * then refuses to become an order is a worse experience than being asked up
 * front. It is still only a convenience: the cart page checks the session on
 * the server, and the order route and the ERP each refuse an order without one.
 */
export function AddToCart({
  tenant,
  slug,
  title,
  disabled,
  outOfStock,
}: {
  tenant: string;
  slug: string;
  /** Only for the quantity control's accessible name. */
  title: string;
  disabled?: boolean;
  /**
   * Kept apart from `disabled` because the two are different sentences: one
   * says the shop has not finished setting the product up, the other says it
   * has sold out. A shopper can act on the second by coming back.
   */
  outOfStock?: boolean;
}) {
  const { add } = useCart(tenant);
  const { session, requireSignIn } = useShopper();
  const pathname = usePathname();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(0);

  if (disabled) {
    return (
      <Notice dashed className="mt-8">
        This item has no price yet, so it cannot be ordered online. Contact the shop.
      </Notice>
    );
  }

  // Only a convenience. The ERP refuses an out-of-stock line at quote and at
  // order, so hiding this button is what spares the shopper the round trip, not
  // what enforces the rule.
  if (outOfStock) {
    return (
      <Notice dashed className="mt-8">
        Out of stock. Check back soon, or contact the shop to ask when it returns.
      </Notice>
    );
  }

  if (requireSignIn && session === null) {
    return (
      <div className="mt-8 flex flex-col items-start gap-3">
        <ButtonLink href={signInHref(tenant, pathname)}>Sign in to buy</ButtonLink>
        <Text variant="bodySmall" tone="subdued">
          This shop takes orders from signed-in customers. We will text you a code;
          there is no password.
        </Text>
      </div>
    );
  }

  // Until the session is known on a gated shop, the button is shown but inert,
  // so the layout does not jump and nothing reaches the cart that the checkout
  // would then refuse.
  const deciding = requireSignIn && session === undefined;

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <QuantityStepper
        value={quantity}
        onChange={setQuantity}
        label={`Quantity of ${title}`}
      />

      <Button
        disabled={deciding}
        onClick={() => {
          add(slug, quantity);
          setAdded(quantity);
          // The quantity resets so the next add is a fresh decision rather than
          // a second helping of the last one — the shopper who wanted twelve
          // has them in the cart already.
          setQuantity(1);
          // The label reverts rather than latching, so adding again still reads
          // as an action rather than an already-done state.
          window.setTimeout(() => setAdded(0), 2500);
        }}
      >
        Add to cart
      </Button>

      {/* Says how many, because the stepper has already reset by the time this
          is read and "Added" alone leaves the shopper counting on trust. */}
      <Text as="span" tone="subdued" aria-live="polite">
        {added ? `Added ${added} to your cart` : ""}
      </Text>
    </div>
  );
}
