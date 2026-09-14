"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Turnstile } from "@/components/turnstile";

import { AvailabilityBadge } from "@/components/availability-badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Icon,
  Input,
  Notice,
  QuantityStepper,
  Spinner,
  Text,
  cx,
  type IconName,
} from "@/design-system";
import { useCart } from "@/lib/cart";
import type { CartLine, PlacedOrder, Quote } from "@/lib/erp";
import { mediaHref } from "@/lib/media";
import { formatPrice } from "@/lib/money";

/**
 * What checkout knows about a signed-in shopper, and nothing more. Built by the
 * cart page from the ERP's session, so every field is the ERP's.
 *
 * `phone` and `email` are *verified* identities — the one the sign-in code was
 * received on — and never something merely typed. A shopper who signed in by
 * email has no verified phone, so `phone` is null and checkout asks for one.
 */
export type CheckoutShopper = {
  name: string | null;
  phone: string | null;
  email: string | null;
  /** From the shopper's most recent order — a suggestion, never a saved address. */
  address: string | null;
  landmark: string | null;
};

type Props = {
  tenant: string;
  shopName: string;
  /** Null for a guest, on a shop that still takes guest orders. */
  shopper: CheckoutShopper | null;
  /** Where to send a shopper whose session the ERP has just refused. */
  signInHref: string;
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
 * Cart and checkout.
 *
 * Every figure on this screen comes from the server. The cart holds slugs and
 * quantities; changing anything re-quotes, so a price that moved since the
 * shopper added the item is reflected before they commit, and the total shown
 * is computed by the same code that will price the order.
 */
export function CartView({ tenant, shopName, shopper, signInHref }: Props) {
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

  if (placed) {
    return <OrderPlaced tenant={tenant} order={placed} signedIn={shopper !== null} />;
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={<Icon name="bag" className="size-12" />}
        title="Your cart is empty"
        description={`Nothing here yet. Anything you add from ${shopName} is kept in this browser until you order.`}
        action={<ButtonLink href={`/${tenant}`}>Continue shopping</ButtonLink>}
      />
    );
  }

  const currency = quote?.tenant.currency;

  const blockedSlug = quoteError ? slugNamedIn(quoteError, lines) : null;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card
          padding={false}
          header={
            <div className="flex items-baseline justify-between gap-4">
              <Text as="h2" variant="headlineMedium">
                Items
              </Text>
              <Text variant="bodySmall" tone="muted" className="tabular-nums">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </Text>
            </div>
          }
        >
          <ul className="divide-y divide-line">
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
          <div className="border-t border-line px-2 py-2 sm:px-3">
            <ButtonLink href={`/${tenant}`} variant="tertiary" size="sm">
              <Icon name="arrow-left" className="size-4" />
              Continue shopping
            </ButtonLink>
          </div>
        </Card>

        {quoteError ? (
          <Notice tone="critical">
            <div className="flex gap-3">
              <Icon name="alert" className="mt-px size-4" />
              <div>
                <p>{quoteError}</p>
                {/* The ERP refuses the whole cart over one bad line, and until
                    that line goes the shopper cannot be quoted at all — so a
                    message with nothing to press is a dead end. The button only
                    appears when the refusal names something actually in this
                    cart. */}
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
              </div>
            </div>
          </Notice>
        ) : null}

        <CheckoutForm shopper={shopper} onSubmit={checkout.submit} />
      </div>

      {/* Sticky only where there is height to spare. On a phone the summary
          sits after the lines and the form, which is the order a shopper reads
          them in — and puts the button that places the order last. */}
      <aside className="w-full lg:sticky lg:top-24">
        <Summary quote={quote} currency={currency} pricing={pricing} itemCount={itemCount}>
          <Turnstile onToken={checkout.setTurnstileToken} resetSignal={checkout.turnstileNonce} />

          {checkout.error ? <Notice tone="critical">{checkout.error}</Notice> : null}

          <Button
            type="submit"
            form={CHECKOUT_FORM}
            size="lg"
            block
            disabled={pricing || !quote || !checkout.tokenReady}
            loading={checkout.submitting}
          >
            {checkout.submitting ? "Placing order…" : "Place order"}
          </Button>

          <ul className="flex flex-col gap-2.5 text-body-sm text-ink-subdued">
            <Assurance icon="cash">Payment is on delivery.</Assurance>
            <Assurance icon="shield">
              Prices are checked against the shop&rsquo;s live catalog as your order is
              placed.
            </Assurance>
          </ul>
        </Summary>
      </aside>
    </div>
  );
}

/**
 * The delivery form's state and its submit.
 *
 * A hook rather than a component because its two halves render in different
 * places: the fields sit with the cart lines, and the button, the challenge and
 * any refusal sit in the order summary beside the total being committed to.
 *
 * A 401 means the ERP no longer accepts the session. The shopper is sent to
 * sign in and brought back here; the cart is in localStorage and is not
 * touched, so nothing they chose is lost on the way.
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
            name: form.get("name"),
            phone: shopper?.phone ?? form.get("phone"),
            address: form.get("address"),
            landmark: form.get("landmark"),
          },
          note: form.get("note"),
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
    <li className="flex gap-4 p-4 sm:gap-5 sm:p-5">
      <Link
        href={`/${tenant}/product/${line.slug}`}
        // Decorative here: the title beside it is the same link, and a screen
        // reader announcing the product twice per row makes a cart tedious.
        tabIndex={-1}
        aria-hidden="true"
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-media p-1.5 sm:size-24"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- see the note on ProductCard.
          <img src={image} alt="" loading="lazy" className="size-full object-contain" />
        ) : (
          <ImagePlaceholder className="scale-75" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/${tenant}/product/${line.slug}`}
              className="line-clamp-2 text-title font-semibold text-ink-strong hover:underline hover:underline-offset-4"
            >
              {title}
            </Link>

            {priced && currency ? (
              <Text variant="bodySmall" tone="subdued" className="mt-0.5 tabular-nums">
                {formatPrice(priced.unitPriceMinor, currency)} each
              </Text>
            ) : null}
          </div>

          {priced && currency ? (
            <Text variant="titleLarge" tone="strong" className="shrink-0 text-right tabular-nums">
              {formatPrice(priced.lineTotalMinor, currency)}
            </Text>
          ) : null}
        </div>

        {/* Multi-buy savings are shown, not silently applied. A total lower
            than price × quantity looks like a mistake unless the shopper is
            told why it is lower. */}
        {priced?.discountMinor && currency ? (
          <Text variant="bodySmall" tone="success" className="mt-1 tabular-nums">
            Multi-buy saving {formatPrice(priced.discountMinor, currency)}
          </Text>
        ) : null}

        {priced?.availability ? (
          <div className="mt-2">
            <AvailabilityBadge availability={priced.availability} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
            // Names the product: a column of identical "Remove" buttons is a
            // guessing game for anyone moving through them by keyboard.
            aria-label={`Remove ${title}`}
          >
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

/**
 * What the basket comes to, with the controls that commit to it underneath.
 *
 * Every figure is the server's. While a re-quote is in flight the last good
 * total stays on screen dimmed rather than disappearing — a total that blinks
 * out on each quantity tap reads as a page losing track of the order.
 */
function Summary({
  quote,
  currency,
  pricing,
  itemCount,
  children,
}: {
  quote: Quote | null;
  currency: Quote["tenant"]["currency"] | undefined;
  pricing: boolean;
  itemCount: number;
  children: ReactNode;
}) {
  return (
    <Card
      padding={false}
      header={
        <Text as="h2" variant="headlineMedium">
          Order summary
        </Text>
      }
    >
      <div
        className={cx(
          "p-4 transition-opacity sm:p-5",
          pricing && quote ? "opacity-60" : undefined,
        )}
      >
        {!quote || !currency ? (
          <div className="flex items-center gap-2 text-ink-muted">
            {pricing ? <Spinner className="size-3.5" label="" /> : null}
            <Text variant="bodySmall" tone="inherit">
              {pricing ? "Pricing your cart…" : "Your total will appear here."}
            </Text>
          </div>
        ) : (
          <>
            <dl className="space-y-2.5 text-body-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-subdued">
                  Items <span className="tabular-nums">({itemCount})</span>
                </dt>
                <dd className="tabular-nums">{formatPrice(itemsTotal(quote), currency)}</dd>
              </div>

              {quote.delivery ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-subdued">{quote.delivery.title}</dt>
                  <dd className="tabular-nums">
                    {quote.delivery.waived ? (
                      <span className="font-semibold text-success">Free</span>
                    ) : (
                      formatPrice(quote.delivery.amountMinor, currency)
                    )}
                  </dd>
                </div>
              ) : null}

              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3 text-ink-strong">
                <dt className="text-title font-semibold">Total</dt>
                <dd className="text-h3 font-bold tabular-nums">
                  {formatPrice(quote.totalMinor, currency)}
                </dd>
              </div>
            </dl>

            {/* Not a row of its own: the ERP folds tax into every figure above,
                so a "Tax" line here would read as something still to be added. */}
            {quote.taxMinor > 0 ? (
              <Text variant="caption" tone="muted" className="mt-2 tabular-nums">
                Includes {formatPrice(quote.taxMinor, currency)} tax.
              </Text>
            ) : null}

            {quote.delivery && !quote.delivery.waived && quote.delivery.freeOverMinor ? (
              <Text variant="caption" tone="muted" className="mt-1 tabular-nums">
                Delivery is free over {formatPrice(quote.delivery.freeOverMinor, currency)}.
              </Text>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-line p-4 sm:p-5">{children}</div>
    </Card>
  );
}

function Assurance({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon name={icon} className="mt-px size-4 text-ink-muted" />
      <span>{children}</span>
    </li>
  );
}

/**
 * The delivery form.
 *
 * For a signed-in shopper the fields start from the account: the name the shop
 * has for them and the address and landmark from their last order, all of it
 * editable, because a parcel can go somewhere new.
 *
 * A verified phone is not editable. It is the number the sign-in code was
 * received on, and the ERP records that number for a signed-in order whatever
 * the form sends — so offering a box to type another one into would be offering
 * a choice that is not honoured. It is still sent, so a guest body and a
 * signed-in body stay one shape. A shopper who signed in by email has no
 * verified phone, and the rider still needs one to call, so for them the phone
 * is an ordinary required field and their verified address is shown instead,
 * read-only, as the identity the order is placed under.
 */
function CheckoutForm({
  shopper,
  onSubmit,
}: {
  shopper: CheckoutShopper | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form id={CHECKOUT_FORM} onSubmit={onSubmit} className="flex flex-col gap-6">
      <CheckoutSection
        icon="user"
        title="Contact"
        description="Who the shop calls to confirm before delivering."
      >
        <CheckoutField
          name="name"
          label="Your name"
          required
          autoComplete="name"
          defaultValue={shopper?.name ?? undefined}
        />
        {shopper?.phone ? (
          <CheckoutField
            name="phone"
            label="Phone"
            type="tel"
            value={shopper.phone}
            readOnly
            hint="Verified with the code we sent. Sign out to order with another number."
          />
        ) : (
          <CheckoutField
            name="phone"
            label="Phone"
            required
            type="tel"
            autoComplete="tel"
            hint={shopper ? "For the rider to call when they arrive." : undefined}
          />
        )}
        {shopper?.email ? (
          <CheckoutField
            name="email"
            label="Email"
            type="email"
            value={shopper.email}
            readOnly
            hint="Verified with the code we sent. This order is placed under it."
            wide
          />
        ) : null}
      </CheckoutSection>

      <CheckoutSection
        icon="truck"
        title="Delivery"
        description="Where the rider brings your order."
      >
        <CheckoutField
          name="address"
          label="Delivery address"
          required
          autoComplete="street-address"
          defaultValue={shopper?.address ?? undefined}
          wide
        />
        <CheckoutField
          name="landmark"
          label="Landmark"
          hint="A shop or crossing the rider will know."
          defaultValue={shopper?.landmark ?? undefined}
          wide
        />
        <CheckoutField name="note" label="Anything the shop should know" wide />
      </CheckoutSection>
    </form>
  );
}

function CheckoutSection({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card
      padding={false}
      header={
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subdued text-ink-subdued">
            <Icon name={icon} className="size-4.5" />
          </span>
          <div>
            <Text as="h2" variant="headlineMedium">
              {title}
            </Text>
            <Text variant="caption" tone="muted">
              {description}
            </Text>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">{children}</div>
    </Card>
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
  defaultValue,
  value,
  readOnly,
  wide,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  hint?: string;
  /** A starting point the shopper can change — the account's details. */
  defaultValue?: string;
  /** Fixed, with `readOnly`: shown and submitted, but not the shopper's to edit. */
  value?: string;
  readOnly?: boolean;
  /** Spans both columns on a wide screen — an address does not fit half a row. */
  wide?: boolean;
}) {
  return (
    <Field
      id={`checkout-${name}`}
      label={label}
      required={required}
      hint={hint}
      className={wide ? "sm:col-span-2" : undefined}
    >
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
          // A variant rather than a plain override: `bg-surface` in the base
          // classes would otherwise win or lose on stylesheet order alone.
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
    <section className="mx-auto mt-8 max-w-2xl">
      <Card padding={false} elevation="md">
        <div className="flex flex-col items-center gap-3 px-6 pt-10 pb-8 text-center sm:px-10">
          <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <Icon name="check" className="size-7" />
          </span>
          <Text as="h2" variant="displayMedium" className="mt-2 text-balance">
            Order {order.orderNumber} received
          </Text>
          <Text variant="bodyLarge" tone="subdued" className="max-w-md">
            The shop will call you to confirm before delivering. Payment is on delivery.
          </Text>
          {order.currency ? (
            <div className="mt-3 rounded-md bg-surface-subdued px-5 py-3">
              <Text variant="caption" tone="muted">
                Total
              </Text>
              <Text variant="displayMedium" as="p" className="tabular-nums">
                {formatPrice(order.totalMinor, order.currency)}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 border-t border-line p-6 sm:px-10">
          {/*
            The status link is shown once, here, and never emailed or stored: this
            is the only copy the shopper will get, because the shop keeps a hash of
            the token rather than the token. Worth saying so plainly — otherwise
            someone closes the tab and has no way back to their own order.
          */}
          <Notice tone="info">
            <div className="flex gap-3">
              <Icon name="info" className="mt-px size-4" />
              <div>
                <p>
                  <Link
                    href={`/${tenant}/order/${order.statusToken}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    Track or cancel this order
                  </Link>
                </p>
                {/* A signed-in order is in the account's history as well, so the
                    link is no longer the only way back — but it is still the only
                    way to cancel, which the account pages cannot do yet. */}
                <p className="mt-1">
                  {signedIn ? (
                    <>
                      It is also in{" "}
                      <Link
                        href={`/${tenant}/account`}
                        className="underline underline-offset-4"
                      >
                        your orders
                      </Link>
                      . Keep this link if you may want to cancel — cancelling happens
                      there.
                    </>
                  ) : (
                    "Save this link — it is the only way back to your order, and it is not sent anywhere else."
                  )}
                </p>
              </div>
            </div>
          </Notice>

          <div className="flex justify-center">
            <ButtonLink href={`/${tenant}`} variant="secondary">
              Keep shopping
            </ButtonLink>
          </div>
        </div>
      </Card>
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
