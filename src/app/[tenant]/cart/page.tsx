import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CartView } from "@/app/[tenant]/cart/cart-view";
import { Text } from "@/design-system";
import { fetchShop } from "@/lib/erp";

type PageProps = { params: Promise<{ tenant: string }> };

export const metadata: Metadata = {
  title: "Cart",
  // A cart is per-shopper and worthless in search results.
  robots: { index: false },
};

export default async function CartPage({ params }: PageProps) {
  const { tenant } = await params;

  // The layout has already established that this shop is open; this call is
  // deduped against its own and exists only to name the shop in the empty-cart
  // copy. `notFound` stays as the type-level floor rather than a second check.
  const shop = await fetchShop(tenant);
  if (!shop) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Text as="h1" variant="displayMedium" className="mb-8 border-b border-line pb-6">
        Your cart
      </Text>

      <CartView tenant={tenant} shopName={shop.name} />
    </main>
  );
}
