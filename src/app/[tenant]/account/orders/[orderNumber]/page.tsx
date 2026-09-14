import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { OrderDetails } from "@/app/[tenant]/order/[token]/order-details";
import { Breadcrumbs, Container } from "@/design-system";
import { fetchAccountOrder, isUnauthorized } from "@/lib/erp";
import { signInHref } from "@/lib/next-path";
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
 * It renders from the same component as the guest status page, so the two
 * describe an order identically.
 */
export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ tenant: string; orderNumber: string }>;
}) {
  const { tenant, orderNumber } = await params;

  // Back to this order after signing in, not to the list above it.
  const signIn = signInHref(tenant, `/${tenant}/account/orders/${encodeURIComponent(orderNumber)}`);

  const session = await readSession(tenant);
  if (!session) redirect(signIn);

  let order;
  try {
    order = await fetchAccountOrder(tenant, session, orderNumber);
  } catch (error) {
    if (isUnauthorized(error)) redirect(signIn);
    throw error;
  }

  if (!order) notFound();

  return (
    <Container as="main" className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: `/${tenant}` },
            { label: "Your orders", href: `/${tenant}/account` },
            { label: `Order ${order.orderNumber ?? orderNumber}` },
          ]}
        />
        <OrderDetails order={order} orderNumber={orderNumber} />
      </div>
    </Container>
  );
}
