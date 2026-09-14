"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Button, ButtonLink, Icon, Notice, QuantityStepper, Text } from "@/design-system";
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
  requireSignIn,
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
  /**
   * The shop's `requireSignIn`, from the product page's own `fetchProduct` —
   * a minute old at most — rather than the layout's hour-old tenant, so a
   * merchant's change reaches this button in about the time a price change
   * does. Still only a convenience; the ERP decides at the order.
   */
  requireSignIn: boolean;
}) {
  const { add } = useCart(tenant);
  const { session } = useShopper();
  const pathname = usePathname();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(0);

  if (disabled) {
    return (
      <Notice dashed>
        <span className="flex items-start gap-2">
          <Icon name="info" className="mt-px size-4" />
          This item has no price yet, so it cannot be ordered online. Contact the shop.
        </span>
      </Notice>
    );
  }

  // Only a convenience. The ERP refuses an out-of-stock line at quote and at
  // order, so hiding this button is what spares the shopper the round trip, not
  // what enforces the rule.
  if (outOfStock) {
    return (
      <Notice dashed>
        <span className="flex items-start gap-2">
          <Icon name="info" className="mt-px size-4" />
          Out of stock. Check back soon, or contact the shop to ask when it returns.
        </span>
      </Notice>
    );
  }

  if (requireSignIn && session === null) {
    return (
      <div className="flex flex-col gap-3">
        <ButtonLink href={signInHref(tenant, pathname)} block>
          <Icon name="user" />
          Sign in to buy
        </ButtonLink>
        <Text variant="bodySmall" tone="subdued">
          This shop takes orders from signed-in customers. We will send you a
          code; there is no password.
        </Text>
      </div>
    );
  }

  // Until the session is known on a gated shop, the button is shown but inert,
  // so the layout does not jump and nothing reaches the cart that the checkout
  // would then refuse.
  const deciding = requireSignIn && session === undefined;

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          label={`Quantity of ${title}`}
        />

        {/* The stepper's height rather than the large button's, so the two
            read as one control and not as neighbours that disagree by a few
            pixels. */}
        <Button
          block
          className="flex-1"
          disabled={deciding}
          icon={<Icon name="bag" />}
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
      </div>

      {/* Says how many, because the stepper has already reset by the time this
          is read and "Added" alone leaves the shopper counting on trust.

          Laid over the space beneath the row rather than taking room of its
          own: the confirmation appearing does not shove everything below it
          down the page and back, and an empty line does not hold a gap open
          the rest of the time. Whatever follows this component leaves at
          least `mt-8` for it. */}
      <p
        aria-live="polite"
        className="absolute inset-x-0 top-full mt-1 flex h-6 items-center text-body-sm"
      >
        {added ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 font-semibold text-success">
              <Icon name="check" className="size-4" />
              Added {added} to your cart
            </span>
            <Link
              href={`/${tenant}/cart`}
              className="font-semibold text-ink-strong underline underline-offset-4"
            >
              View cart
            </Link>
          </span>
        ) : null}
      </p>
    </div>
  );
}
