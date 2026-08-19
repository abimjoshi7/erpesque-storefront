import Link from "next/link";

import { Text } from "@/design-system";
import { listingHref, withFilters, type ListingFilters } from "@/lib/catalog-url";
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
  current: ListingFilters;
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
  current: ListingFilters;
}) {
  if (facets.length === 0) return null;

  const selected = current[param];

  return (
    <div>
      <Text as="h2" variant="labelSmall" tone="muted" className="uppercase">
        {heading}
      </Text>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-x-0">
        {selected ? (
          <li>
            <Link
              href={listingHref(tenant, withFilters(current, { [param]: undefined }))}
              className="text-body-sm text-ink-muted underline underline-offset-4"
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
                href={listingHref(tenant, withFilters(current, { [param]: facet.value }))}
                aria-current={isSelected ? "true" : undefined}
                className={
                  isSelected
                    ? "text-body-sm font-semibold text-ink-strong"
                    : "text-body-sm text-ink-subdued hover:underline hover:underline-offset-4"
                }
              >
                {facet.value}{" "}
                <span className="text-ink-disabled tabular-nums">{facet.productCount}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
