import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { fetchProduct } from "@/lib/erp";
import { formatPrice } from "@/lib/money";

type PageProps = {
  params: Promise<{ tenant: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenant, slug } = await params;
  const result = await fetchProduct(tenant, slug);
  if (!result) return { title: "Product not found" };

  const { product, tenant: shop } = result;
  return {
    title: `${product.title} — ${shop.name}`,
    description: product.description ?? undefined,
    openGraph: {
      title: product.title,
      description: product.description ?? undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { tenant, slug } = await params;
  const result = await fetchProduct(tenant, slug);

  // Unpublished, inactive, deleted and simply nonexistent all arrive here as
  // the same 404 — a shopper cannot tell which, which is the intent.
  if (!result) notFound();

  const { product, tenant: shop } = result;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/${tenant}`}
        className="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-400"
      >
        ← {shop.name}
      </Link>

      <article className="mt-8">
        {product.category ? (
          <p className="text-xs uppercase tracking-wide text-neutral-500">{product.category}</p>
        ) : null}

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          {product.title}
        </h1>

        {product.brand ? (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{product.brand}</p>
        ) : null}

        <p className="mt-6 text-2xl tabular-nums">
          {formatPrice(product.priceMinor, shop.currency!)}
        </p>

        {product.description ? (
          <p className="mt-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
            {product.description}
          </p>
        ) : null}

        {/* Cart and checkout land in the next slice. Stating that is more
            honest than a button that does nothing. */}
        <p className="mt-10 rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
          Ordering is not available yet.
        </p>
      </article>
    </main>
  );
}
