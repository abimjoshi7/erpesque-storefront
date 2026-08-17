import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { fetchOrderStatus } from "@/lib/erp";
import { formatPrice } from "@/lib/money";

import { CancelOrder } from "./cancel-button";

type PageProps = {
  params: Promise<{ tenant: string; token: string }>;
};

/**
 * The token in this URL is the only thing standing between a stranger and
 * someone's name, phone number and home address, so the page is kept out of
 * search indexes and out of referrer headers.
 *
 * `noindex` is not paranoia: shoppers paste links into chat apps that follow
 * them, and a crawler that reached one would put a delivery address in a search
 * result.
 */
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Personal and changes as the shop works through it — never prerendered. */
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; detail: string }> = {
  pending: {
    label: "Waiting for the shop",
    detail: "The shop will call you to confirm before delivering.",
  },
  confirmed: {
    label: "Confirmed",
    detail: "The shop has accepted your order and is preparing it.",
  },
  partially_sent: {
    label: "Partly on its way",
    detail: "Some of your order has been sent; the rest is following.",
  },
  delivered: {
    label: "Delivered",
    detail: "This order has been delivered in full.",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This order will not be delivered.",
  },
};

export default async function OrderStatusPage({ params }: PageProps) {
  const { tenant, token } = await params;
  const order = await fetchOrderStatus(tenant, token);

  // A wrong token, a token for another shop, and an order that never existed
  // are all this same 404 — which is what stops the page being used to find out
  // whether an order number is real.
  if (!order) notFound();

  const currency = order.currency;
  const copy = STATUS_COPY[order.status] ?? STATUS_COPY.pending;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/${tenant}`}
        className="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-400"
      >
        ← Keep shopping
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        Order {order.orderNumber ?? ""}
      </h1>

      <p className="mt-4 inline-flex rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-900">
        {copy.label}
      </p>
      <p className="mt-3 text-neutral-700 dark:text-neutral-300">{copy.detail}</p>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          What you ordered
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
          {(order.lines ?? []).map((line, index) => (
            <li key={index} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {line.title}
                {line.quantity && line.quantity !== 1 ? (
                  <span className="text-neutral-500"> × {line.quantity}</span>
                ) : null}
              </span>
              <span className="tabular-nums">
                {currency ? formatPrice(line.lineTotalMinor ?? 0, currency) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-neutral-200 pt-3 font-medium dark:border-neutral-800">
          <span>Total</span>
          <span className="tabular-nums">
            {currency ? formatPrice(order.totalMinor, currency) : null}
          </span>
        </p>
        <p className="mt-2 text-xs text-neutral-500">Payment is on delivery.</p>
      </section>

      <section className="mt-8 text-sm text-neutral-700 dark:text-neutral-300">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Delivering to
        </h2>
        <p className="mt-3">{order.contactName}</p>
        <p>{order.deliveryAddress}</p>
        {order.deliveryLandmark ? (
          <p className="text-neutral-500">{order.deliveryLandmark}</p>
        ) : null}
        {order.note ? <p className="mt-3 italic text-neutral-500">“{order.note}”</p> : null}
      </section>

      {order.cancellable ? (
        <CancelOrder tenant={tenant} token={token} />
      ) : (
        <p className="mt-8 text-sm text-neutral-500">
          {order.status === "cancelled"
            ? "This order has been cancelled."
            : "The shop has started on this order, so it can no longer be cancelled here. Call them if something has changed."}
        </p>
      )}
    </main>
  );
}
