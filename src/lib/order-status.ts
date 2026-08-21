import type { StatusTone } from "@/design-system";

/**
 * Each ERP order status, in the shopper's words and in the design system's
 * tones — the same pairing `DSStatusPill.toneForStatus` makes on the ERP side,
 * so an order that is amber on the clerk's screen is amber on the shopper's.
 *
 * Lives here rather than beside one page because two pages now render it: the
 * status page a guest reaches with their token, and the account order page a
 * signed-in buyer reaches with an order number. They show the same order and
 * must describe it the same way.
 */
export const STATUS_COPY: Record<
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

/** Falls back to `pending`, which is what an unknown status most resembles. */
export function statusCopy(status: string | undefined | null) {
  return (status ? STATUS_COPY[status] : undefined) ?? STATUS_COPY.pending;
}

/**
 * The order's date, in a locale-independent long form.
 *
 * Fixed to `en-GB` rather than the visitor's locale on purpose: these pages are
 * server-rendered, the server has no idea what the browser's locale is, and
 * formatting with one guess on the server and another on the client is a
 * hydration mismatch on a page about someone's money.
 *
 * The time of day is left off. It is a delivery order placed by phone-and-van;
 * "19 August 2026" is what a shopper checks it against.
 */
export function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
