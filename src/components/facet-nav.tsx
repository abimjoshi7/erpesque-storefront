import Link from "next/link";

import type { Facet } from "@/lib/erp";

/**
 * Category and brand navigation.
 *
 * Links, not a client-side filter control. The filtered listing has to be a
 * real URL for the same reason the pagination is: `?category=Beverage` is what
 * a crawler indexes and a shopper shares, and a `useState` filter produces
 * neither.
 *
 * Selecting a facet resets to page 1, because page 4 of the full catalog is
 * usually past the end of one category — and landing on an empty page reads as
 * a broken shop rather than a narrowed one.
 */
export function FacetNav({
  tenant,
  facets,
  current,
}: {
  tenant: string;
  facets: { categories: Facet[]; brands: Facet[] };
  current: { q?: string; category?: string; brand?: string };
}) {
  if (facets.categories.length === 0 && facets.brands.length === 0) return null;

  return (
    <nav aria-label="Filter products" className="flex flex-col gap-6">
      <FacetGroup
        heading="Categories"
        tenant={tenant}
        param="category"
        facets={facets.categories}
        current={current}
      />
      <FacetGroup
        heading="Brands"
        tenant={tenant}
        param="brand"
        facets={facets.brands}
        current={current}
      />
    </nav>
  );
}

function FacetGroup({
  heading,
  tenant,
  param,
  facets,
  current,
}: {
  heading: string;
  tenant: string;
  param: "category" | "brand";
  facets: Facet[];
  current: { q?: string; category?: string; brand?: string };
}) {
  if (facets.length === 0) return null;

  const selected = current[param];

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {heading}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-x-0">
        {selected ? (
          <li>
            <Link
              href={facetHref(tenant, { ...current, [param]: undefined })}
              className="text-sm text-neutral-500 underline underline-offset-4"
            >
              All {heading.toLowerCase()}
            </Link>
          </li>
        ) : null}
        {facets.map((facet) => {
          const isSelected = selected?.toLowerCase() === facet.value.toLowerCase();
          return (
            <li key={facet.value}>
              <Link
                href={facetHref(tenant, { ...current, [param]: facet.value })}
                aria-current={isSelected ? "true" : undefined}
                className={
                  isSelected
                    ? "text-sm font-medium"
                    : "text-sm text-neutral-600 hover:underline hover:underline-offset-4 dark:text-neutral-400"
                }
              >
                {facet.value}{" "}
                <span className="text-neutral-400 tabular-nums">{facet.productCount}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Builds a listing URL, carrying the filters that are not being changed.
 *
 * The search term survives a category click on purpose: a shopper who searched
 * and then narrowed by category means both, and dropping one silently would
 * show them results they did not ask for.
 */
function facetHref(
  tenant: string,
  filters: { q?: string; category?: string; brand?: string },
): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.category) search.set("category", filters.category);
  if (filters.brand) search.set("brand", filters.brand);
  const query = search.toString();
  return query ? `/${tenant}?${query}` : `/${tenant}`;
}
