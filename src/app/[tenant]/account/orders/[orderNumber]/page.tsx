import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { StatusPill, Text } from "@/design-system";
import { fetchAccountOrder, isUnauthorized } from "@/lib/erp";
import { formatPrice } from "@/lib/money";
import { formatOrderDate, statusCopy } from "@/lib/order-status";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One of the account's own orders, reached by its number rather than by a
 * status token.
 *
 * Order numbers are sequential and guessable, which is the whole reason guests
 * get an opaque token instead. This page is safe for a different reason: the
 * session is the authorisation, not the number in the URL. The ERP scopes the
 * lookup to the signed-in account, so another account's order number comes back
 * as the same 404 as one that was never issued.
 *
 * It renders from the same copy and the same helpers as the guest status page,
 * so the two describe an order identically.
 */
export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ tenant: string; orderNumber: string }>;
}) {
  const { tenant, orderNumber } = await params;

  const session = await readSession(tenant);
  if (!session) redirect(`/${tenant}/sign-in`);

  let order;
  try {
    order = await fetchAccountOrder(tenant, session, orderNumber);
  } catch (error) {
    if (isUnauthorized(error)) redirect(`/${tenant}/sign-in`);
    throw error;
  }

  if (!order) notFound();

  const currency = order.currency;
  const copy = statusCopy(order.status);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/${tenant}/account`} className="text-body-sm underline">
        All your orders
      </Link>

      <Text as="h1" variant="displayMedium" className="mt-4">
        Order {order.orderNumber ?? orderNumber}
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
    </main>
  );
}
