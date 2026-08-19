"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Turnstile } from "@/components/turnstile";

import { AvailabilityBadge } from "@/components/availability-badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  QuantityStepper,
  Text,
} from "@/design-system";
import { useCart } from "@/lib/cart";
import type { CartLine, PlacedOrder, Quote } from "@/lib/erp";
import { mediaHref } from "@/lib/media";
import { formatPrice } from "@/lib/money";

type Props = { tenant: string; shopName: string };

/**
 * Asks the server to price the cart. Deliberately free of React state so the
 * effect that calls it stays a plain "fetch, then record the answer".
 */
async function priceCart(
  tenant: string,
  lines: CartLine[],
): Promise<{ quote: Quote | null; error: string | null }> {
  try {
    const response = await fetch(`/api/${tenant}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const body = (await response.json()) as { data?: Quote; error?: string };
    if (!response.ok) {
      return { quote: null, error: body.error ?? "Could not price your cart." };
    }
    return { quote: body.data ?? null, error: null };
  } catch {
    return { quote: null, error: "Could not reach the shop. Check your connection." };
  }
}

/**
 * Cart and checkout.
 *
 * Every figure on this screen comes from the server. The cart holds slugs and
 * quantities; changing anything re-quotes, so a price that moved since the
 * shopper added the item is reflected before they commit, and the total shown
 * is computed by the same code that will price the order.
 */
export function CartView({ tenant, shopName }: Props) {
  const { lines, setQuantity, remove, clear } = useCart(tenant);

  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // The quote is stamped with the cart it was priced for. Without that stamp a
  // stale quote from the previous cart keeps rendering while the new one is in
  // flight, showing the shopper a total that no longer matches their basket.
  const cartKey = JSON.stringify(lines);
  const [result, setResult] = useState<{
    key: string;
    quote: Quote | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (lines.length === 0) return;

    let cancelled = false;
    void (async () => {
      // Every state update below happens after an await, so this effect never
      // sets state synchronously and cannot cascade renders.
      const next = await priceCart(tenant, lines);
      if (!cancelled) setResult({ key: cartKey, ...next });
    })();

    // Guards against an out-of-order response overwriting a newer one when the
    // shopper changes quantity twice quickly.
    return () => {
      cancelled = true;
    };
  }, [cartKey, lines, tenant]);

  const current = result?.key === cartKey ? result : null;
  const quote = current?.quote ?? null;
  const quoteError = current?.error ?? null;
  // Derived rather than stored: the cart has lines but no answer for them yet.
  const pricing = lines.length > 0 && current === null;

  if (placed) {
    return <OrderPlaced tenant={tenant} order={placed} />;
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Nothing here yet. Anything you add is kept in this browser until you order."
        action={
          <ButtonLink href={`/${tenant}`} variant="secondary">
            Browse {shopName}
          </ButtonLink>
        }
      />
    );
  }

  const currency = quote?.tenant.currency;

  const blockedSlug = quoteError ? slugNamedIn(quoteError, lines) : null;

  return (
    <section className="flex flex-col gap-10 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <CartRow
              key={line.slug}
              tenant={tenant}
              line={line}
              // Matched by slug rather than index: a failed quote returns no
              // lines at all, and positions would silently mispair titles.
              priced={quote?.lines.find((entry) => entry.slug === line.slug)}
              currency={currency}
              onQuantity={(quantity) => setQuantity(line.slug, quantity)}
              onRemove={() => remove(line.slug)}
            />
          ))}
        </ul>

        {quoteError ? (
          <Notice tone="critical" className="mt-6">
            <p>{quoteError}</p>
            {/* The ERP refuses the whole cart over one bad line, and until that
                line goes the shopper cannot be quoted at all — so a message
                with nothing to press is a dead end. The button only appears
                when the refusal names something actually in this cart. */}
            {blockedSlug ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => remove(blockedSlug)}
              >
                Remove it and carry on
              </Button>
            ) : null}
          </Notice>
        ) : null}

        <Checkout
          tenant={tenant}
          disabled={pricing || !quote}
          onPlaced={(order) => {
            clear();
            setPlaced(order);
          }}
          lines={lines}
        />
      </div>

      {/* Sticky only where there is height to spare. On a phone the summary
          sits after the lines, which is the order a shopper reads them in. */}
      <aside className="w-full lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
        <Summary quote={quote} currency={currency} pricing={pricing} />
      </aside>
    </section>
  );
}

/**
 * One line of the basket.
 *
 * `priced` is absent until the first quote lands and while a failed one is on
 * screen, so every figure here is optional and the row still renders without
 * them — a cart that blanks out because the server is slow looks broken.
 */
function CartRow({
  tenant,
  line,
  priced,
  currency,
  onQuantity,
  onRemove,
}: {
  tenant: string;
  line: CartLine;
  priced: Quote["lines"][number] | undefined;
  currency: Quote["tenant"]["currency"] | undefined;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const title = priced?.title ?? line.slug;
  const image = priced?.image ? mediaHref(tenant, priced.image) : null;

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={`/${tenant}/product/${line.slug}`}
        // Decorative here: the title beside it is the same link, and a screen
        // reader announcing the product twice per row makes a cart tedious.
        tabIndex={-1}
        aria-hidden="true"
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-subdued"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- see the note on ProductCard.
          <img src={image} alt="" loading="lazy" className="size-full object-contain" />
        ) : (
          <ImagePlaceholder className="scale-75" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/${tenant}/product/${line.slug}`}
          className="text-title font-semibold text-ink-strong hover:underline hover:underline-offset-4"
        >
          {title}
        </Link>

        {priced && currency ? (
          <Text variant="bodySmall" tone="subdued" className="tabular-nums">
            {formatPrice(priced.unitPriceMinor, currency)} each
          </Text>
        ) : null}

        {/* Multi-buy savings are shown, not silently applied. A total lower
            than price × quantity looks like a mistake unless the shopper is
            told why it is lower. */}
        {priced?.discountMinor && currency ? (
          <Text variant="bodySmall" tone="success" className="tabular-nums">
            Multi-buy saving {formatPrice(priced.discountMinor, currency)}
          </Text>
        ) : null}

        {priced?.availability ? (
          <div className="mt-0.5">
            <AvailabilityBadge availability={priced.availability} />
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <QuantityStepper
            size="sm"
            value={line.quantity}
            onChange={onQuantity}
            label={`Quantity of ${title}`}
          />
          <Button variant="tertiary" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      <div className="shrink-0 text-right">
        {priced && currency ? (
          <Text variant="titleLarge" tone="strong" className="tabular-nums">
            {formatPrice(priced.lineTotalMinor, currency)}
          </Text>
        ) : null}
      </div>
    </li>
  );
}

/**
 * What the basket comes to.
 *
 * Every figure is the server's. While a re-quote is in flight the last good
 * total stays on screen dimmed rather than disappearing — a total that blinks
 * out on each quantity tap reads as a page losing track of the order.
 */
function Summary({
  quote,
  currency,
  pricing,
}: {
  quote: Quote | null;
  currency: Quote["tenant"]["currency"] | undefined;
  pricing: boolean;
}) {
  if (!quote || !currency) {
    return (
      <Card>
        <Text variant="bodySmall" tone="muted">
          {pricing ? "Pricing your cart…" : "Your total will appear here."}
        </Text>
      </Card>
    );
  }

  return (
    <Card
      header={
        <Text as="h2" variant="headlineMedium">
          Order summary
        </Text>
      }
      className={pricing ? "opacity-60 transition-opacity" : "transition-opacity"}
    >
      <dl className="space-y-2 text-body-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-subdued">Items</dt>
          <dd className="tabular-nums">{formatPrice(itemsTotal(quote), currency)}</dd>
        </div>

        {quote.delivery ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-subdued">{quote.delivery.title}</dt>
            <dd className="tabular-nums">
              {quote.delivery.waived
                ? "Free"
                : formatPrice(quote.delivery.amountMinor, currency)}
            </dd>
          </div>
        ) : null}

        <div className="flex justify-between gap-4 border-t border-line pt-2 text-title font-semibold text-ink-strong">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(quote.totalMinor, currency)}</dd>
        </div>
      </dl>

      {/* Not a row of its own: the ERP folds tax into every figure above, so a
          "Tax" line here would read as something still to be added. */}
      {quote.taxMinor > 0 ? (
        <Text variant="caption" tone="muted" className="mt-3 tabular-nums">
          Includes {formatPrice(quote.taxMinor, currency)} tax.
        </Text>
      ) : null}

      <Text variant="caption" tone="muted" className="mt-1">
        Payment is on delivery.
        {quote.delivery && !quote.delivery.waived && quote.delivery.freeOverMinor
          ? ` Delivery is free over ${formatPrice(quote.delivery.freeOverMinor, currency)}.`
          : ""}
      </Text>
    </Card>
  );
}

function Checkout({
  tenant,
  lines,
  disabled,
  onPlaced,
}: {
  tenant: string;
  lines: { slug: string; quantity: number }[];
  disabled: boolean;
  onPlaced: (order: PlacedOrder) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped after every failed submit. The token Cloudflare issued has been
  // spent by then, and re-sending it would fail as a replay — which would look
  // to the shopper like their corrected address was rejected too.
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  return (
    <form
      className="mt-10 flex flex-col gap-4 border-t border-line pt-8"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setSubmitting(true);
        setError(null);
        try {
          const response = await fetch(`/api/${tenant}/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines,
              contact: {
                name: form.get("name"),
                phone: form.get("phone"),
                address: form.get("address"),
                landmark: form.get("landmark"),
              },
              note: form.get("note"),
              turnstileToken,
            }),
          });
          const body = (await response.json()) as { data?: PlacedOrder; error?: string };
          if (!response.ok || !body.data) {
            setError(body.error ?? "Could not place your order.");
            setTurnstileNonce((nonce) => nonce + 1);
            return;
          }
          onPlaced(body.data);
        } catch {
          setError("Could not reach the shop. Check your connection.");
          setTurnstileNonce((nonce) => nonce + 1);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Text as="h2" variant="headlineLarge">
        Delivery details
      </Text>

      <CheckoutField name="name" label="Your name" required autoComplete="name" />
      <CheckoutField name="phone" label="Phone" required type="tel" autoComplete="tel" />
      <CheckoutField
        name="address"
        label="Delivery address"
        required
        autoComplete="street-address"
      />
      <CheckoutField
        name="landmark"
        label="Landmark"
        hint="A shop or crossing the rider will know."
      />
      <CheckoutField name="note" label="Anything the shop should know" />

      <Turnstile onToken={setTurnstileToken} resetSignal={turnstileNonce} />

      {error ? <Notice tone="critical">{error}</Notice> : null}

      <Button
        type="submit"
        className="self-start"
        disabled={disabled}
        loading={submitting}
      >
        {submitting ? "Placing order…" : "Place order"}
      </Button>
    </form>
  );
}

/**
 * One checkout input.
 *
 * A thin wrapper over the design system's [Field] rather than a use of it
 * directly, because every control here shares the same id-from-name convention
 * and the same "optional unless marked" rule, and repeating both five times is
 * how two of them end up disagreeing.
 *
 * Validation is the browser's `required` and the ERP's own reply. Nothing is
 * re-checked in between: a second opinion here would either duplicate the
 * server's rules or contradict them, and it is the server that decides whether
 * an order is accepted.
 */
function CheckoutField({
  name,
  label,
  required,
  type = "text",
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <Field id={`checkout-${name}`} label={label} required={required} hint={hint}>
      {(control) => (
        <Input
          {...control}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
        />
      )}
    </Field>
  );
}

function OrderPlaced({ tenant, order }: { tenant: string; order: PlacedOrder }) {
  return (
    <section className="flex flex-col gap-4">
      <Text as="h2" variant="displayMedium">
        Order {order.orderNumber} received
      </Text>
      <Text variant="bodyLarge" tone="subdued">
        The shop will call you to confirm before delivering. Payment is on delivery.
      </Text>
      {order.currency ? (
        <Text variant="titleLarge" tone="strong" className="tabular-nums">
          Total: {formatPrice(order.totalMinor, order.currency)}
        </Text>
      ) : null}

      {/*
        The status link is shown once, here, and never emailed or stored: this
        is the only copy the shopper will get, because the shop keeps a hash of
        the token rather than the token. Worth saying so plainly — otherwise
        someone closes the tab and has no way back to their own order.
      */}
      <Notice tone="info">
        <p>
          <Link
            href={`/${tenant}/order/${order.statusToken}`}
            className="font-semibold underline underline-offset-4"
          >
            Track or cancel this order
          </Link>
        </p>
        <p className="mt-1">
          Save this link — it is the only way back to your order, and it is not sent
          anywhere else.
        </p>
      </Notice>

      <div>
        <ButtonLink href={`/${tenant}`} variant="secondary">
          Keep shopping
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * The cart line an ERP refusal is about, when it names one.
 *
 * The ERP rejects a whole cart over a single line and says which — "'boot-polish'
 * is no longer available". Rather than parse that sentence, every slug the cart
 * actually holds is checked against it, so a message this code does not
 * recognise simply produces no button instead of a wrong one. Nothing depends
 * on the wording: if the ERP stops naming the slug, the shopper still gets the
 * message they always got.
 */
function slugNamedIn(message: string, lines: CartLine[]): string | null {
  return lines.find((line) => message.includes(line.slug))?.slug ?? null;
}

/**
 * What the goods come to, delivery excluded.
 *
 * Not `quote.subtotalMinor`: the ERP prices delivery as a line like any other
 * and folds it into both the subtotal and the tax. Rendering that figure above
 * a separate delivery row showed the charge twice, in a column where items plus
 * delivery did not add up to the total.
 *
 * Subtracting one server-authoritative integer from another is not a second
 * implementation of the pricing rules — both are gross figures, so no tax or
 * rounding decision is being remade here. The result is exactly the sum of the
 * line totals listed above it.
 */
function itemsTotal(quote: Quote): number {
  return quote.totalMinor - (quote.delivery?.amountMinor ?? 0);
}
