import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { Card, EmptyState, StatusPill, Text } from "@/design-system";
import { fetchOrders, fetchShopperSession, isUnauthorized } from "@/lib/erp";
import { formatPrice } from "@/lib/money";
import { formatOrderDate, statusCopy } from "@/lib/order-status";
import { readSession } from "@/lib/session";

import { SignOut } from "./sign-out";

/**
 * Someone's order history: what they bought, where it went. Kept out of search
 * indexes for the same reason the guest status page is.
 */
export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

/** Personal, and it changes as the shop works — never prerendered. */
export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenant } = await params;
  const { page: pageParam } = await searchParams;

  const session = await readSession(tenant);
  if (!session) redirect(`/${tenant}/sign-in`);

  const page = Number(pageParam) > 1 ? Number(pageParam) : 1;

  // Side by side rather than one after the other: the history and the name at
  // the top are independent reads of the same session.
  let history;
  let shopper;
  try {
    [history, shopper] = await Promise.all([
      fetchOrders(tenant, session, { page }),
      fetchShopperSession(tenant, session),
    ]);
  } catch (error) {
    // An expired session lands back at sign-in rather than in the error
    // boundary: it is the ordinary end of a session, not a failure.
    if (isUnauthorized(error)) redirect(`/${tenant}/sign-in`);
    throw error;
  }

  if (!history) redirect(`/${tenant}/sign-in`);

  // The identity the shopper proved. An email sign-in has no verified phone,
  // and saying which address this account is means a shopper with two — one by
  // phone, one by email, which are separate accounts for now — can tell which
  // history they are looking at.
  const signedInAs = shopper?.shopper.phone ?? shopper?.shopper.email;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <Text as="h1" variant="displayMedium">
          Your orders
        </Text>
        <SignOut tenant={tenant} />
      </div>
      {signedInAs ? (
        <Text variant="bodySmall" tone="muted" className="mt-2">
          Signed in as {signedInAs}
        </Text>
      ) : null}

      {history.orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Anything you order from this shop will show up here."
          className="mt-10"
        />
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {history.orders.map((order, index) => {
            const copy = statusCopy(order.status);
            // Each row carries its own currency rather than borrowing the
            // tenant's, so a total always renders in the money the order was
            // actually written in.
            const total = order.currency
              ? formatPrice(order.totalMinor, order.currency)
              : null;
            const body = (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Text variant="titleSmall" className="font-semibold">
                    {order.orderNumber ?? "Order"}
                  </Text>
                  <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Text variant="bodySmall" tone="muted">
                    {order.orderDate ? formatOrderDate(order.orderDate) : null}
                    {order.lineCount
                      ? ` · ${order.lineCount} item${order.lineCount === 1 ? "" : "s"}`
                      : null}
                  </Text>
                  <Text variant="bodySmall" className="tabular-nums font-semibold">
                    {total}
                  </Text>
                </div>
              </>
            );

            return (
              <li key={order.orderNumber ?? `row-${index}`}>
                <Card padding={false}>
                  {/* The number is what opens the order, so a row without one
                      is shown and not linked rather than hidden — the shopper
                      still spent that money. */}
                  {order.orderNumber ? (
                    <Link
                      href={`/${tenant}/account/orders/${encodeURIComponent(order.orderNumber)}`}
                      className="flex flex-col gap-2 rounded-lg p-4 transition-colors hover:bg-surface-subdued"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-2 p-4">{body}</div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {history.totalPages > 1 ? (
        <nav className="mt-8 flex items-center justify-between" aria-label="Order history pages">
          {page > 1 ? (
            <Link href={`/${tenant}/account?page=${page - 1}`} className="text-body-sm underline">
              Newer
            </Link>
          ) : (
            <span />
          )}
          <Text variant="caption" tone="muted">
            Page {history.page} of {history.totalPages}
          </Text>
          {page < history.totalPages ? (
            <Link href={`/${tenant}/account?page=${page + 1}`} className="text-body-sm underline">
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
