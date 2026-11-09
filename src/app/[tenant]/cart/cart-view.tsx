"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Turnstile } from "@/components/turnstile";

import {
  Button,
  ButtonLink,
  Field,
  Icon,
  Input,
  Notice,
  QuantityStepper,
  Spinner,
  Text,
  cx,
} from "@/design-system";
import { useCart } from "@/lib/cart";
import type { CartLine, PlacedOrder, Quote, Tenant } from "@/lib/erp";
import { formatPrice } from "@/lib/money";

/**
 * What checkout knows about a signed-in shopper, and nothing more. Built by the
 * cart page from the ERP's session, so every field is the ERP's.
 *
 * `phone` is the verified number — the one the sign-in code was received on —
 * and never something merely typed. A guest has no shopper here, so checkout
 * asks them to type one.
 */
export type CheckoutShopper = {
  name: string | null;
  phone: string | null;
  /** Saved at sign-in, or taken from the latest order when sign-in has not saved one. */
  address: string | null;
  landmark: string | null;
};

/**
 * The product the sale desk is showing beside the grid.
 *
 * A snapshot, not a live catalog row: the shopper can filter the grid away
 * from the product they chose, and the rail still has to name it.
 */
export type RailProduct = {
  slug: string;
  title: string;
  category?: string | null;
  priceMinor?: number | null;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | null;
  image: string | null;
};

type Props = {
  tenant: string;
  /** Null for a guest, on a shop that still takes guest orders. */
  shopper: CheckoutShopper | null;
  /**
   * False while the session answer is still in flight. The delivery form uses
   * `defaultValue`, which only applies on mount, so it waits rather than
   * opening empty and then throwing the shopper's name away.
   */
  shopperReady: boolean;
  /** Where to send a shopper whose session the ERP has just refused. */
  signInHref: string;
  /** Courtesy gate. The order route and the ERP still decide. */
  requireSignIn: boolean;
  /** Catalog currency, so the selected card can price itself before a quote. */
  currency: NonNullable<Tenant["currency"]> | null;
  selection: RailProduct | null;
};

/**
 * The delivery form's id. The submit button sits in the order summary, beside
 * the total it commits to, rather than under the last field — so it reaches the
 * form through the `form` attribute instead of by being inside it.
 */
const CHECKOUT_FORM = "checkout-form";

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
 * The order ticket beside the product grid.
 *
 * It is a counter slip, not a checkout page. Lines, quantities and the total
 * stay on the ticket with the customer's name and phone. Confirming the ticket
 * opens the delivery step in a dialog, the way a payment step opens after the
 * basket is set.
 *
 * Every figure comes from the server. The cart holds slugs and quantities;
 * changing anything re-quotes, so a price that moved since the item was added
 * is reflected before they commit.
 */
export function CartView({
  tenant,
  shopper,
  shopperReady,
  signInHref,
  requireSignIn,
  currency: catalogCurrency,
  selection,
}: Props) {
  const { lines, setQuantity, remove, clear } = useCart(tenant);

  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  // The address step. The ticket stays the screen until they say the items are
  // the order; an emptied cart drops back to the ticket on its own.
  const [delivering, setDelivering] = useState(false);
  const deliveryRef = useRef<HTMLDialogElement>(null);

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

  const checkout = useCheckout({
    tenant,
    shopper,
    signInHref,
    lines,
    onPlaced: (order) => {
      clear();
      setPlaced(order);
    },
  });

  const current = result?.key === cartKey ? result : null;
  const quote = current?.quote ?? null;
  const quoteError = current?.error ?? null;
  // Derived rather than stored: the cart has lines but no answer for them yet.
  const pricing = lines.length > 0 && current === null;
  const takingDelivery = delivering && lines.length > 0;

  useEffect(() => {
    const dialog = deliveryRef.current;
    if (!dialog) return;
    if (takingDelivery && !dialog.open) dialog.showModal();
    if (!takingDelivery && dialog.open) dialog.close();
  }, [takingDelivery]);

  if (placed) {
    return <OrderPlaced tenant={tenant} order={placed} signedIn={shopper !== null} />;
  }

  const currency = quote?.tenant.currency ?? catalogCurrency ?? undefined;
  const stockBlocked = selection?.availability === "out_of_stock";
  const priceBlocked =
    selection != null && (selection.priceMinor === null || selection.priceMinor === undefined);
  const signInBlocked = requireSignIn && shopperReady && shopper === null;
  const heldBack =
    selection != null && !lines.some((line) => line.slug === selection.slug)
      ? stockBlocked
        ? "Out of stock."
        : priceBlocked
          ? "No price yet."
          : null
      : null;

  const blockedSlug = quoteError ? slugNamedIn(quoteError, lines) : null;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Text as="h2" variant="titleLarge">
          Order
        </Text>
        {lines.length === 0 ? (
          <Text variant="bodySmall" tone="subdued" className="mt-2">
            No items
          </Text>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {lines.map((line) => (
              <TicketLine
                key={line.slug}
                line={line}
                // Matched by slug rather than index: a failed quote returns no
                // lines at all, and positions would silently mispair titles.
                priced={quote?.lines.find((entry) => entry.slug === line.slug)}
                currency={currency}
                selected={selection?.slug === line.slug}
                titleFallback={selection?.slug === line.slug ? selection.title : undefined}
                onQuantity={(quantity) => setQuantity(line.slug, quantity)}
                onRemove={() => remove(line.slug)}
              />
            ))}
          </ul>
        )}
        {heldBack && selection ? (
          <Text variant="bodySmall" tone="subdued" className="mt-2">
            {selection.title}. {heldBack}
          </Text>
        ) : null}
      </div>

      {quoteError ? (
        <Notice tone="critical">
          <div className="flex gap-3">
            <Icon name="alert" className="mt-px size-4" />
            <div>
              <p>{quoteError}</p>
              {/* The ERP refuses the whole cart over one bad line, and until
                  that line goes the ticket cannot be priced — so a message
                  with nothing to press is a dead end. The button only appears
                  when the refusal names something actually on this ticket. */}
              {blockedSlug ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => remove(blockedSlug)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </Notice>
      ) : null}

      {signInBlocked ? <SignInToOrder href={signInHref} /> : null}
      {lines.length > 0 && !signInBlocked && !shopperReady ? (
        <Text variant="bodySmall" tone="muted">
          Checking the customer…
        </Text>
      ) : null}

      {lines.length > 0 && !signInBlocked && shopperReady ? (
        <form
          id={CHECKOUT_FORM}
          onSubmit={(event) => {
            if (!takingDelivery) {
              event.preventDefault();
              if (customerReady(event.currentTarget)) setDelivering(true);
              return;
            }
            checkout.submit(event);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-3">
            <Text as="h2" variant="titleLarge">
              Customer
            </Text>
            <CheckoutField
              name="name"
              label="Name"
              required
              autoComplete="name"
              defaultValue={shopper?.name ?? undefined}
            />
            {shopper?.phone ? (
              <CheckoutField
                name="phone"
                label="Phone"
                required
                type="tel"
                value={shopper.phone}
                readOnly
              />
            ) : (
              <CheckoutField
                name="phone"
                label="Phone"
                required
                type="tel"
                autoComplete="tel"
              />
            )}
          </div>

          <Total quote={quote} currency={currency} pricing={pricing} />

          <Button type="submit" size="lg" block disabled={pricing || !quote}>
            Deliver
          </Button>

          <dialog
            ref={deliveryRef}
            aria-labelledby="delivery-title"
            onClose={() => setDelivering(false)}
            className={cx(
              "m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-5 text-ink shadow-lg",
              "backdrop:bg-ink-strong/60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Text id="delivery-title" as="h2" variant="titleLarge">
                  Deliver
                </Text>
                <Text variant="bodySmall" tone="subdued" className="mt-1 tabular-nums">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </Text>
              </div>
              <Button
                variant="tertiary"
                size="sm"
                iconOnly
                aria-label="Close"
                disabled={checkout.submitting}
                icon={<Icon name="x" className="size-4" />}
                onClick={() => setDelivering(false)}
              />
            </div>
            <div className="mt-4">
              <CheckoutField
                name="address"
                label="Address"
                required={takingDelivery}
                autoComplete="street-address"
                defaultValue={shopper?.address ?? undefined}
              />
            </div>
            <div className="mt-4">
              <Total quote={quote} currency={currency} pricing={pricing} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Turnstile
                onToken={checkout.setTurnstileToken}
                resetSignal={checkout.turnstileNonce}
              />
              {checkout.error ? <Notice tone="critical">{checkout.error}</Notice> : null}
              <Button
                type="submit"
                size="lg"
                block
                disabled={pricing || !quote || !checkout.tokenReady}
                loading={checkout.submitting}
              >
                {checkout.submitting ? "Sending…" : "Send order"}
              </Button>
            </div>
          </dialog>
        </form>
      ) : lines.length > 0 ? (
        <Total quote={quote} currency={currency} pricing={pricing} />
      ) : null}
    </div>
  );
}

function customerReady(form: HTMLFormElement): boolean {
  const name = form.elements.namedItem("name");
  const phone = form.elements.namedItem("phone");
  if (name instanceof HTMLInputElement && !name.checkValidity()) {
    name.reportValidity();
    return false;
  }
  if (phone instanceof HTMLInputElement && !phone.checkValidity()) {
    phone.reportValidity();
    return false;
  }
  return true;
}

function SignInToOrder({ href }: { href: string }) {
  return (
    <ButtonLink href={href} block>
      <Icon name="user" />
      Sign in
    </ButtonLink>
  );
}

/**
 * One line on the ticket.
 *
 * `priced` is absent until the first quote lands and while a failed one is on
 * screen, so the row still names the item without a figure.
 */
function TicketLine({
  line,
  priced,
  currency,
  selected,
  titleFallback,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  priced: Quote["lines"][number] | undefined;
  currency: Quote["tenant"]["currency"] | undefined;
  selected: boolean;
  titleFallback: string | undefined;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const title = priced?.title ?? titleFallback ?? line.slug;

  return (
    <li className={cx("flex flex-col gap-2 py-3", selected && "bg-surface-subdued -mx-2 px-2")}>
      <div className="flex items-baseline justify-between gap-3">
        <Text as="p" variant="bodyMedium" tone="strong" className="min-w-0">
          {title}
        </Text>
        {priced && currency ? (
          <Text variant="bodyMedium" tone="strong" className="shrink-0 tabular-nums">
            {formatPrice(priced.lineTotalMinor, currency)}
          </Text>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <QuantityStepper
          size="sm"
          value={line.quantity}
          onChange={onQuantity}
          label={`Quantity of ${title}`}
        />
        <Button
          variant="tertiary"
          size="sm"
          icon={<Icon name="trash" className="size-4" />}
          onClick={onRemove}
          aria-label={`Remove ${title}`}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

/**
 * Sends the ticket.
 *
 * A 401 means the ERP no longer accepts the session. The customer is sent to
 * sign in and brought back here; the ticket is in localStorage and is not
 * touched.
 */
function useCheckout({
  tenant,
  shopper,
  signInHref,
  lines,
  onPlaced,
}: {
  tenant: string;
  shopper: CheckoutShopper | null;
  signInHref: string;
  lines: { slug: string; quantity: number }[];
  onPlaced: (order: PlacedOrder) => void;
}) {
  const router = useRouter();
  const { refresh } = useShopper();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped after every failed submit. The token Cloudflare issued has been
  // spent by then, and re-sending it would fail as a replay — which would look
  // to the shopper like their corrected address was rejected too.
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  // With a site key configured the ERP refuses an order without a token, so the
  // button waits for one rather than inviting a submit that is certain to fail.
  const needsToken = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  async function submit(event: FormEvent<HTMLFormElement>) {
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
            name: shopper?.name || field(form, "name"),
            phone: shopper?.phone || field(form, "phone"),
            address: shopper?.address || field(form, "address"),
            landmark: shopper?.landmark || undefined,
          },
          turnstileToken,
        }),
      });
      const body = (await response.json()) as { data?: PlacedOrder; error?: string };
      if (response.status === 401) {
        // The handler has already dropped the dead cookie. The shared
        // shopper state is told too, so the header stops naming someone
        // who is no longer signed in.
        await refresh();
        router.push(signInHref);
        return;
      }
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
  }

  return {
    submit,
    submitting,
    error,
    setTurnstileToken,
    turnstileNonce,
    tokenReady: !needsToken || Boolean(turnstileToken),
  };
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The figure the ticket commits to.
 *
 * While a re-quote is in flight the last good total stays, dimmed, rather than
 * disappearing — a total that blinks out on each quantity tap reads as the
 * counter losing the order.
 */
function Total({
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
      <div className="flex items-center gap-2 text-ink-muted">
        {pricing ? <Spinner className="size-3.5" label="" /> : null}
        <Text variant="bodySmall" tone="inherit">
          {pricing ? "Pricing…" : "Total pending"}
        </Text>
      </div>
    );
  }

  return (
    <dl className={cx("space-y-1.5", pricing && quote ? "opacity-60" : undefined)}>
      {quote.delivery ? (
        <div className="flex justify-between gap-4 text-body-sm">
          <dt className="text-ink-subdued">{quote.delivery.title}</dt>
          <dd className="tabular-nums">
            {quote.delivery.waived ? "Free" : formatPrice(quote.delivery.amountMinor, currency)}
          </dd>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-4 text-ink-strong">
        <dt className="text-title font-semibold">Total</dt>
        <dd className="text-h3 font-bold tabular-nums">
          {formatPrice(quote.totalMinor, currency)}
        </dd>
      </div>
    </dl>
  );
}

function CheckoutField({
  name,
  label,
  required,
  type = "text",
  autoComplete,
  defaultValue,
  value,
  readOnly,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  value?: string;
  readOnly?: boolean;
}) {
  return (
    <Field id={`checkout-${name}`} label={label} required={required}>
      {(control) => (
        <Input
          {...control}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          value={value}
          readOnly={readOnly}
          className="min-h-11 read-only:bg-surface-subdued read-only:text-ink-subdued"
        />
      )}
    </Field>
  );
}

function OrderPlaced({
  tenant,
  order,
  signedIn,
}: {
  tenant: string;
  order: PlacedOrder;
  signedIn: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Text as="h2" variant="titleLarge">
          Order {order.orderNumber}
        </Text>
        <Text variant="bodySmall" tone="subdued" className="mt-1">
          Pay on delivery.
        </Text>
        {order.currency ? (
          <Text variant="displayMedium" as="p" className="mt-3 tabular-nums">
            {formatPrice(order.totalMinor, order.currency)}
          </Text>
        ) : null}
      </div>
      <Link
        href={`/${tenant}/order/${order.statusToken}`}
        className="text-body-sm font-semibold text-ink-strong underline underline-offset-4"
      >
        Track or cancel
      </Link>
      {signedIn ? (
        <Link
          href={`/${tenant}/account`}
          className="text-body-sm text-ink-subdued underline underline-offset-4"
        >
          Orders
        </Link>
      ) : (
        <Text variant="caption" tone="muted">
          Keep the track link. It is the only way back to this order.
        </Text>
      )}
      <ButtonLink href={`/${tenant}`} variant="secondary">
        New order
      </ButtonLink>
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
