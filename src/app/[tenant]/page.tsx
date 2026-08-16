import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { fetchCatalog } from "@/lib/erp";
import { formatPrice } from "@/lib/money";

type PageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenant } = await params;
  const catalog = await fetchCatalog(tenant, { limit: 1 });
  if (!catalog) return { title: "Shop not found" };

  return {
    title: `${catalog.tenant.name} — Shop`,
    description: `Browse ${catalog.total} products from ${catalog.tenant.name}.`,
  };
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const { tenant } = await params;
  const { q, category, page } = await searchParams;

  const catalog = await fetchCatalog(tenant, {
    q,
    category,
    page: page ? Number(page) : undefined,
  });

  // The ERP returns 404 for an unknown tenant, a suspended one, and one that
  // has not enabled the storefront module alike — so this page cannot be used
  // to work out which tenant codes exist.
  if (!catalog) notFound();

  const { products, tenant: shop } = catalog;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {catalog.total} {catalog.total === 1 ? "product" : "products"}
          {category ? ` in ${category}` : ""}
          {q ? ` matching “${q}”` : ""}
        </p>
      </header>

      {products.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          Nothing here yet. Try a different search.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.slug}>
              <Link
                href={`/${tenant}/product/${product.slug}`}
                className="flex h-full flex-col justify-between rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-800 dark:hover:border-neutral-600"
              >
                <div>
                  {product.category ? (
                    <p className="text-xs uppercase tracking-wide text-neutral-500">
                      {product.category}
                    </p>
                  ) : null}
                  <h2 className="mt-1 font-medium">{product.title}</h2>
                </div>
                <p className="mt-4 tabular-nums">
                  {formatPrice(product.priceMinor, shop.currency!)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination tenant={tenant} page={catalog.page} totalPages={catalog.totalPages} />
    </main>
  );
}

/**
 * Plain links, not a client-side control: the whole point of offset pagination
 * here is that `?page=2` is a real URL a crawler can follow.
 */
function Pagination({
  tenant,
  page,
  totalPages,
}: {
  tenant: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-12 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link href={`/${tenant}?page=${page - 1}`} className="underline underline-offset-4">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-neutral-500 tabular-nums">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`/${tenant}?page=${page + 1}`} className="underline underline-offset-4">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
