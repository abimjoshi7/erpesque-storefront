import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CartLink } from "@/components/cart-link";
import { FacetNav } from "@/components/facet-nav";
import { ProductCard } from "@/components/product-card";
import { fetchCatalog, fetchFacets } from "@/lib/erp";

type PageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; category?: string; brand?: string; page?: string }>;
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
  const { q, category, brand, page } = await searchParams;

  // In parallel: the two are independent, and awaiting them in sequence would
  // add the facet round trip to every listing render for nothing.
  const [catalog, facets] = await Promise.all([
    fetchCatalog(tenant, {
      q,
      category,
      brand,
      page: page ? Number(page) : undefined,
    }),
    fetchFacets(tenant),
  ]);

  // The ERP returns 404 for an unknown tenant, a suspended one, and one that
  // has not enabled the storefront module alike — so this page cannot be used
  // to work out which tenant codes exist.
  if (!catalog) notFound();

  const { products, tenant: shop } = catalog;
  const filters = { q, category, brand };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
          <CartLink tenant={tenant} />
        </div>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {catalog.total} {catalog.total === 1 ? "product" : "products"}
          {category ? ` in ${category}` : ""}
          {brand ? ` by ${brand}` : ""}
          {q ? ` matching “${q}”` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-10 lg:flex-row">
        {facets ? (
          <aside className="lg:w-48 lg:shrink-0">
            <FacetNav tenant={tenant} facets={facets} current={filters} />
          </aside>
        ) : null}

        <div className="flex-1">
          {products.length === 0 ? (
            <p className="text-neutral-600 dark:text-neutral-400">
              Nothing here yet. Try a different search.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <li key={product.slug}>
                  <ProductCard tenant={tenant} product={product} currency={shop.currency!} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            tenant={tenant}
            page={catalog.page}
            totalPages={catalog.totalPages}
            filters={filters}
          />
        </div>
      </div>
    </main>
  );
}

/**
 * Plain links, not a client-side control: the whole point of offset pagination
 * here is that `?page=2` is a real URL a crawler can follow.
 *
 * The active filters are carried through. Without that, page 2 of a category
 * silently becomes page 2 of the whole catalog — the shopper's filter vanishes
 * the moment they page, which is the sort of thing nobody reports as a bug and
 * everybody abandons the shop over.
 */
function Pagination({
  tenant,
  page,
  totalPages,
  filters,
}: {
  tenant: string;
  page: number;
  totalPages: number;
  filters: { q?: string; category?: string; brand?: string };
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    if (filters.q) search.set("q", filters.q);
    if (filters.category) search.set("category", filters.category);
    if (filters.brand) search.set("brand", filters.brand);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `/${tenant}?${query}` : `/${tenant}`;
  };

  return (
    <nav className="mt-12 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className="underline underline-offset-4">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-neutral-500 tabular-nums">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="underline underline-offset-4">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
