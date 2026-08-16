import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CartView } from "@/app/[tenant]/cart/cart-view";
import { fetchCatalog } from "@/lib/erp";

type PageProps = { params: Promise<{ tenant: string }> };

export const metadata: Metadata = {
  title: "Cart",
  // A cart is per-shopper and worthless in search results.
  robots: { index: false },
};

export default async function CartPage({ params }: PageProps) {
  const { tenant } = await params;

  // Resolved on the server purely to enforce the same shop-exists check the
  // other pages get — a cart page for a disabled tenant should 404 too, rather
  // than rendering an empty shell that only fails once someone tries to buy.
  const catalog = await fetchCatalog(tenant, { limit: 1 });
  if (!catalog) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
        <Link href={`/${tenant}`} className="text-sm underline underline-offset-4">
          ← {catalog.tenant.name}
        </Link>
      </header>

      <CartView tenant={tenant} shopName={catalog.tenant.name} />
    </main>
  );
}
