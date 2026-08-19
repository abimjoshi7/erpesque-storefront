import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FacetNav } from "@/components/facet-nav";
import { FilterPanel } from "@/components/filter-panel";
import { ProductCard } from "@/components/product-card";
import { SortMenu } from "@/components/sort-menu";
import { ButtonLink, Container, EmptyState, Text } from "@/design-system";
import {
  isFiltered,
  listingHref,
  readFilters,
  type ListingFilters,
  type RawListingParams,
} from "@/lib/catalog-url";
import { fetchCatalog, fetchFacets } from "@/lib/erp";
import { majorToMinor } from "@/lib/money";

type PageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<RawListingParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenant } = await params;
  const catalog = await fetchCatalog(tenant, { limit: 1 });
  if (!catalog) return { title: "Shop not found" };

  const canonical = `/${encodeURIComponent(tenant)}`;

  return {
    title: `${catalog.tenant.name} — Shop`,
    description: `Browse ${catalog.total} products from ${catalog.tenant.name}.`,
    // Points at the unfiltered listing on purpose. Every search, facet and page
    // number is this same page with a query string, and letting each one be its
    // own indexable URL splits the shop's ranking across near-identical copies.
    alternates: { canonical },
    openGraph: {
      title: `${catalog.tenant.name} — Shop`,
      description: `Browse ${catalog.total} products from ${catalog.tenant.name}.`,
      url: canonical,
      type: "website",
    },
  };
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const { tenant } = await params;
  const filters = readFilters(await searchParams);

  // Facets first, not in parallel with the catalog, because the price bounds in
  // the URL are in major units and converting them needs the shop's currency.
  // It costs nothing: the shop layout above has already made this exact request
  // to name the shop in the header, and Next dedupes it within one render.
  const facets = await fetchFacets(tenant);
  const currency = facets?.tenant.currency;

  const catalog = await fetchCatalog(tenant, {
    q: filters.q,
    category: filters.category,
    brand: filters.brand,
    sort: filters.sort,
    page: filters.page,
    // The ERP prices in minor units; the URL is written in the ones a shopper
    // reads. The conversion happens here and nowhere else.
    minPrice:
      currency && filters.minPrice !== undefined
        ? majorToMinor(filters.minPrice, currency)
        : undefined,
    maxPrice:
      currency && filters.maxPrice !== undefined
        ? majorToMinor(filters.maxPrice, currency)
        : undefined,
    inStock: filters.inStock,
  });

  // The ERP returns 404 for an unknown tenant, a suspended one, and one that
  // has not enabled the storefront module alike — so this page cannot be used
  // to work out which tenant codes exist.
  if (!catalog) notFound();

  const { products, tenant: shop } = catalog;

  return (
    <Container as="main" className="py-12">
      <div className="mb-10 border-b border-line pb-6">
        {/* The shop's own name is the header's job. This heading describes the
            listing instead, so a filtered page says what it is filtered to
            rather than repeating the shop name at every URL. */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Text as="h1" variant="displayLarge" className="text-balance">
              {headingFor(filters)}
            </Text>
            <Text variant="bodySmall" tone="subdued" className="mt-2">
              {catalog.total} {catalog.total === 1 ? "product" : "products"}
              {filters.category ? ` in ${filters.category}` : ""}
              {filters.brand ? ` by ${filters.brand}` : ""}
              {filters.q ? ` matching “${filters.q}”` : ""}
            </Text>
          </div>

          {/* Offered only once there is more than one page's worth to reorder.
              Sorting four products is a control that changes nothing. */}
          {catalog.total > 1 ? <SortMenu tenant={tenant} filters={filters} /> : null}
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row">
        {facets ? (
          <aside className="lg:w-56 lg:shrink-0">
            <FacetNav tenant={tenant} facets={facets} current={filters} />
            <FilterPanel
              tenant={tenant}
              filters={filters}
              currency={facets.tenant.currency}
            />
          </aside>
        ) : null}

        <div className="flex-1">
          {products.length === 0 ? (
            <EmptyState
              title={
                isFiltered(filters)
                  ? "Nothing matched that"
                  : "This shop has not published anything yet"
              }
              description={
                isFiltered(filters)
                  ? "Try a broader search, or drop one of the filters."
                  : "Check back soon — the shop is still setting up."
              }
              // A dead end is where shoppers leave. When something was
              // filtering the listing, the way out of the empty page is the
              // unfiltered one — keeping the ordering they chose, which is a
              // preference rather than a narrowing.
              action={
                isFiltered(filters) ? (
                  <ButtonLink
                    href={listingHref(tenant, { sort: filters.sort })}
                    variant="secondary"
                    size="sm"
                  >
                    Show everything
                  </ButtonLink>
                ) : null
              }
            />
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
    </Container>
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
  filters: ListingFilters;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => listingHref(tenant, { ...filters, page: target });

  return (
    <nav
      className="mt-12 flex items-center justify-between gap-4"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <ButtonLink href={href(page - 1)} variant="secondary" size="sm">
          ← Previous
        </ButtonLink>
      ) : (
        <span />
      )}
      <Text variant="bodySmall" tone="muted" className="tabular-nums">
        Page {page} of {totalPages}
      </Text>
      {page < totalPages ? (
        <ButtonLink href={href(page + 1)} variant="secondary" size="sm">
          Next →
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * What this listing is, in the shopper's words.
 *
 * A search and a facet can both be applied at once, and the search is the more
 * specific of the two — a shopper who typed "rice" inside Grocery is looking
 * for rice, not for Grocery.
 */
function headingFor({ q, category, brand }: ListingFilters): string {
  if (q) return `Results for “${q}”`;
  if (category && brand) return `${brand} in ${category}`;
  return category ?? brand ?? "All products";
}
