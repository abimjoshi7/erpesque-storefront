"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AvailabilityBadge } from "@/components/availability-badge";
import { useCart } from "@/lib/cart";
import type { CartLine, PlacedOrder, Quote } from "@/lib/erp";
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
      <section>
        <p className="text-neutral-600 dark:text-neutral-400">Your cart is empty.</p>
        <Link href={`/${tenant}`} className="mt-4 inline-block underline underline-offset-4">
          Browse {shopName}
        </Link>
      </section>
    );
  }

  const currency = quote?.tenant.currency;

  return (
    <section className="flex flex-col gap-10">
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {lines.map((line) => {
          // Matched by slug rather than index: a failed quote returns no lines
          // at all, and positions would silently mispair titles with rows.
          const priced = quote?.lines.find((entry) => entry.slug === line.slug);
          return (
            <li key={line.slug} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{priced?.title ?? line.slug}</p>
                {priced && currency ? (
                  <p className="text-sm text-neutral-600 tabular-nums dark:text-neutral-400">
                    {formatPrice(priced.unitPriceMinor, currency)} each
                  </p>
                ) : null}
                {/* Multi-buy savings are shown, not silently applied. A total
                    lower than price × quantity looks like a mistake unless the
                    shopper is told why it is lower. */}
                {priced?.discountMinor && currency ? (
                  <p className="text-sm text-emerald-700 tabular-nums dark:text-emerald-400">
                    Multi-buy saving {formatPrice(priced.discountMinor, currency)}
                  </p>
                ) : null}
                {priced?.availability ? (
                  <p className="mt-0.5">
                    <AvailabilityBadge availability={priced.availability} />
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <label className="sr-only" htmlFor={`qty-${line.slug}`}>
                  Quantity for {priced?.title ?? line.slug}
                </label>
                <input
                  id={`qty-${line.slug}`}
                  type="number"
                  min={1}
                  max={999}
                  value={line.quantity}
                  onChange={(event) => setQuantity(line.slug, Number(event.target.value))}
                  className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-right tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                />
                {priced && currency ? (
                  <span className="w-28 text-right tabular-nums">
                    {formatPrice(priced.lineTotalMinor, currency)}
                  </span>
                ) : (
                  <span className="w-28" />
                )}
                <button
                  type="button"
                  onClick={() => remove(line.slug)}
                  className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {quoteError ? (
        <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {quoteError}
        </p>
      ) : null}

      {quote && currency ? (
        <dl className="ml-auto w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600 dark:text-neutral-400">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(quote.subtotalMinor, currency)}</dd>
          </div>
          {quote.taxMinor > 0 ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600 dark:text-neutral-400">Tax</dt>
              <dd className="tabular-nums">{formatPrice(quote.taxMinor, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-medium dark:border-neutral-800">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(quote.totalMinor, currency)}</dd>
          </div>
          <p className="pt-1 text-xs text-neutral-500">
            Payment is on delivery. Delivery charges, if any, are confirmed when the shop
            calls you.
          </p>
        </dl>
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
    </section>
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

  return (
    <form
      className="flex flex-col gap-4 border-t border-neutral-200 pt-8 dark:border-neutral-800"
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
            }),
          });
          const body = (await response.json()) as { data?: PlacedOrder; error?: string };
          if (!response.ok || !body.data) {
            setError(body.error ?? "Could not place your order.");
            return;
          }
          onPlaced(body.data);
        } catch {
          setError("Could not reach the shop. Check your connection.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <h2 className="text-lg font-medium">Delivery details</h2>

      <Field name="name" label="Your name" required autoComplete="name" />
      <Field name="phone" label="Phone" required type="tel" autoComplete="tel" />
      <Field name="address" label="Delivery address" required autoComplete="street-address" />
      <Field name="landmark" label="Landmark (optional)" />
      <Field name="note" label="Anything the shop should know (optional)" />

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled || submitting}
        className="self-start rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {submitting ? "Placing order…" : "Place order"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

function OrderPlaced({ tenant, order }: { tenant: string; order: PlacedOrder }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-medium">Order {order.orderNumber} received</h2>
      <p className="text-neutral-700 dark:text-neutral-300">
        The shop will call you to confirm before delivering. Payment is on delivery.
      </p>
      {order.currency ? (
        <p className="tabular-nums">
          Total: {formatPrice(order.totalMinor, order.currency)}
        </p>
      ) : null}
      <Link href={`/${tenant}`} className="underline underline-offset-4">
        Keep shopping
      </Link>
    </section>
  );
}
