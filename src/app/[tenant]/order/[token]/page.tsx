import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Container, Notice } from "@/design-system";
import { fetchOrderStatus } from "@/lib/erp";

import { CancelOrder } from "./cancel-button";
import { OrderDetails } from "./order-details";

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

export default async function OrderStatusPage({ params }: PageProps) {
  const { tenant, token } = await params;
  const order = await fetchOrderStatus(tenant, token);

  // A wrong token, a token for another shop, and an order that never existed
  // are all this same 404 — which is what stops the page being used to find out
  // whether an order number is real.
  if (!order) notFound();

  return (
    <Container as="main" className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <OrderDetails
          order={order}
          orderNumber=""
          aside={
            order.cancellable ? (
              <CancelOrder tenant={tenant} token={token} />
            ) : (
              <Notice>
                {order.status === "cancelled"
                  ? "This order has been cancelled."
                  : "The shop has started on this order, so it can no longer be cancelled here. Call them if something has changed."}
              </Notice>
            )
          }
        />
      </div>
    </Container>
  );
}
