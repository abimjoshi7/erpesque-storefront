import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  ButtonLink,
  Card,
  Container,
  EmptyState,
  Icon,
  StatusPill,
  Text,
} from "@/design-system";
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
  const name = shopper?.shopper.name;

  return (
    <Container as="main" className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-subdued text-ink-subdued">
              <Icon name="user" className="size-6" />
            </span>
            <div className="min-w-0">
              <Text as="h1" variant="displayMedium">
                Your orders
              </Text>
              {signedInAs ? (
                <Text variant="bodySmall" tone="muted" className="mt-0.5 truncate">
                  Signed in as{" "}
                  <span className="font-medium text-ink">
                    {name ? `${name} · ${signedInAs}` : signedInAs}
                  </span>
                </Text>
              ) : null}
            </div>
          </div>
          <SignOut tenant={tenant} />
        </div>

        {history.orders.length === 0 ? (
          <EmptyState
            icon={<Icon name="package" className="size-12" />}
            title="No orders yet"
            description="Anything you order from this shop will show up here."
            action={<ButtonLink href={`/${tenant}`}>Start shopping</ButtonLink>}
            className="mt-10"
          />
        ) : (
          <Card
            padding={false}
            className="mt-8"
            header={
              <div className="flex items-baseline justify-between gap-4">
                <Text as="h2" variant="headlineMedium">
                  Order history
                </Text>
                <Text variant="bodySmall" tone="muted" className="tabular-nums">
                  {history.total} {history.total === 1 ? "order" : "orders"}
                </Text>
              </div>
            }
          >
            <ul className="divide-y divide-line">
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
                    <span className="hidden size-10 shrink-0 items-center justify-center rounded-md bg-surface-subdued text-ink-subdued sm:flex">
                      <Icon name="package" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Text variant="titleLarge" tone="strong">
                          {order.orderNumber ?? "Order"}
                        </Text>
                        <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
                      </div>
                      <Text variant="bodySmall" tone="muted" className="mt-1">
                        {order.orderDate ? formatOrderDate(order.orderDate) : null}
                        {order.lineCount
                          ? ` · ${order.lineCount} item${order.lineCount === 1 ? "" : "s"}`
                          : null}
                      </Text>
                    </div>
                    <Text variant="titleLarge" tone="strong" className="shrink-0 tabular-nums">
                      {total}
                    </Text>
                  </>
                );

                return (
                  <li key={order.orderNumber ?? `row-${index}`}>
                    {/* The number is what opens the order, so a row without one
                        is shown and not linked rather than hidden — the shopper
                        still spent that money. */}
                    {order.orderNumber ? (
                      <Link
                        href={`/${tenant}/account/orders/${encodeURIComponent(order.orderNumber)}`}
                        className="group flex items-center gap-4 px-4 py-4 transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-subdued sm:px-5"
                      >
                        {body}
                        <Icon
                          name="chevron-right"
                          className="size-4 text-ink-disabled transition-colors group-hover:text-ink-strong"
                        />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {history.totalPages > 1 ? (
          <nav
            className="mt-8 flex items-center justify-between gap-4"
            aria-label="Order history pages"
          >
            {page > 1 ? (
              <ButtonLink
                href={`/${tenant}/account?page=${page - 1}`}
                variant="secondary"
                size="sm"
              >
                <Icon name="chevron-left" className="size-4" />
                Newer
              </ButtonLink>
            ) : (
              <span />
            )}
            <Text variant="bodySmall" tone="muted" className="tabular-nums">
              Page {history.page} of {history.totalPages}
            </Text>
            {page < history.totalPages ? (
              <ButtonLink
                href={`/${tenant}/account?page=${page + 1}`}
                variant="secondary"
                size="sm"
              >
                Older
                <Icon name="chevron-right" className="size-4" />
              </ButtonLink>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </Container>
  );
}
