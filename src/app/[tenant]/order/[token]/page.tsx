import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { StatusPill, Text, type StatusTone } from "@/design-system";
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

/**
 * Each ERP status, in the shopper's words and in the design system's tones —
 * the same pairing `DSStatusPill.toneForStatus` makes on the ERP side, so an
 * order that is amber on the clerk's screen is amber on the shopper's.
 */
const STATUS_COPY: Record<
  string,
  { label: string; detail: string; tone: StatusTone }
> = {
  pending: {
    label: "Waiting for the shop",
    detail: "The shop will call you to confirm before delivering.",
    tone: "warning",
  },
  confirmed: {
    label: "Confirmed",
    detail: "The shop has accepted your order and is preparing it.",
    tone: "info",
  },
  partially_sent: {
    label: "Partly on its way",
    detail: "Some of your order has been sent; the rest is following.",
    tone: "info",
  },
  delivered: {
    label: "Delivered",
    detail: "This order has been delivered in full.",
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This order will not be delivered.",
    tone: "critical",
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
      <Text as="h1" variant="displayMedium">
        Order {order.orderNumber ?? ""}
      </Text>

      {order.orderDate ? (
        <Text variant="bodySmall" tone="muted" className="mt-1">
          Placed {formatOrderDate(order.orderDate)}
        </Text>
      ) : null}

      <div className="mt-4">
        <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
      </div>
      <Text variant="bodyLarge" tone="subdued" className="mt-3">
        {copy.detail}
      </Text>

      <section className="mt-8">
        <Text as="h2" variant="labelSmall" tone="muted" className="uppercase">
          What you ordered
        </Text>
        <ul className="mt-3 divide-y divide-line">
          {(order.lines ?? []).map((line, index) => (
            <li key={index} className="flex justify-between gap-4 py-3 text-body-sm">
              <span>
                {line.title}
                {line.quantity && line.quantity !== 1 ? (
                  <span className="text-ink-muted"> × {line.quantity}</span>
                ) : null}
              </span>
              <span className="tabular-nums">
                {currency ? formatPrice(line.lineTotalMinor ?? 0, currency) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-line pt-3 text-title font-semibold text-ink-strong">
          <span>Total</span>
          <span className="tabular-nums">
            {currency ? formatPrice(order.totalMinor, currency) : null}
          </span>
        </p>
        <Text variant="caption" tone="muted" className="mt-2">
          Payment is on delivery.
        </Text>
      </section>

      <section className="mt-8 text-body-sm text-ink">
        <Text as="h2" variant="labelSmall" tone="muted" className="uppercase">
          Delivering to
        </Text>
        <p className="mt-3">{order.contactName}</p>
        <p>{order.deliveryAddress}</p>
        {order.deliveryLandmark ? (
          <p className="text-ink-muted">{order.deliveryLandmark}</p>
        ) : null}
        {order.note ? (
          <p className="mt-3 text-ink-muted italic">“{order.note}”</p>
        ) : null}
      </section>

      {order.cancellable ? (
        <CancelOrder tenant={tenant} token={token} />
      ) : (
        <Text variant="bodySmall" tone="muted" className="mt-8">
          {order.status === "cancelled"
            ? "This order has been cancelled."
            : "The shop has started on this order, so it can no longer be cancelled here. Call them if something has changed."}
        </Text>
      )}
    </main>
  );
}

/**
 * The order's date, in the shopper's own locale-independent long form.
 *
 * Fixed to `en-GB` rather than the visitor's locale on purpose: this page is
 * server-rendered, the server has no idea what the browser's locale is, and
 * formatting with one guess on the server and another on the client is a
 * hydration mismatch on a page about someone's money.
 *
 * The time of day is left off. It is a delivery order placed by phone-and-van;
 * "19 August 2026" is what a shopper checks it against.
 */
function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
