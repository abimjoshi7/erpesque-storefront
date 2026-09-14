import Link from "next/link";

import { Icon, Text, cx } from "@/design-system";
import { listingHref, withFilters, type ListingFilters } from "@/lib/catalog-url";
import type { Facet } from "@/lib/erp";

/**
 * How many values a group shows before the rest fold away.
 *
 * Six covers the shelves most shoppers want on a shop this size, and keeps the
 * price filter beneath within reach instead of a screen further down. The
 * fold only appears when it would hide at least two values — a disclosure that
 * reveals a single line costs a tap to save one.
 */
const VISIBLE = 6;

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
  className,
}: {
  tenant: string;
  facets: { categories: Facet[]; brands: Facet[] };
  current: ListingFilters;
  className?: string;
}) {
  if (facets.categories.length === 0 && facets.brands.length === 0) return null;

  return (
    <nav
      aria-label="Filter products"
      className={cx("flex flex-col divide-y divide-line", className)}
    >
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
  const isSelected = (facet: Facet) =>
    selected?.toLowerCase() === facet.value.toLowerCase();
  const { shown, folded } = splitFacets(facets, isSelected);

  const item = (facet: Facet) => (
    <li key={facet.value}>
      <FacetLink
        href={listingHref(tenant, withFilters(current, { [param]: facet.value }))}
        facet={facet}
        selected={isSelected(facet)}
      />
    </li>
  );

  return (
    <div className="py-5 first:pt-0">
      <Text as="h2" variant="labelMedium" tone="strong">
        {heading}
      </Text>
      <ul className="mt-3 flex flex-col gap-0.5">
        {selected ? (
          <li>
            <Link
              href={listingHref(tenant, withFilters(current, { [param]: undefined }))}
              className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-body-sm text-ink-subdued hover:bg-surface-subdued hover:text-ink-strong"
            >
              <Icon name="arrow-left" className="size-3.5 shrink-0" />
              All {heading.toLowerCase()}
            </Link>
          </li>
        ) : null}
        {shown.map(item)}
      </ul>

      {/* A `<details>` rather than a client toggle, like the phone's Filters
          panel around it: the rest of the list is one tap away with or without
          JavaScript, and every value in it is still a plain link. Its group is
          named so the chevron answers this disclosure and not the Filters one
          it sits inside on a phone. */}
      {folded.length > 0 ? (
        <details className="group/more">
          <summary
            className={cx(
              "-mx-2 mt-0.5 flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5",
              "text-body-sm font-medium text-ink-strong hover:bg-surface-subdued",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            <span className="group-open/more:hidden">
              Show all {facets.length} {heading.toLowerCase()}
            </span>
            <span className="hidden group-open/more:inline">Show fewer</span>
            <Icon
              name="chevron-down"
              className="size-3.5 text-ink-muted transition-transform duration-(--duration-fast) ease-standard group-open/more:rotate-180"
            />
          </summary>
          <ul className="mt-0.5 flex flex-col gap-0.5">{folded.map(item)}</ul>
        </details>
      ) : null}
    </div>
  );
}

function FacetLink({
  href,
  facet,
  selected,
}: {
  href: string;
  facet: Facet;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cx(
        "-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-body-sm",
        "transition-colors duration-(--duration-fast) ease-standard",
        selected
          ? "bg-surface-subdued font-semibold text-ink-strong"
          : "text-ink-subdued hover:bg-surface-subdued hover:text-ink-strong",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {selected ? <Icon name="check" className="size-3.5 shrink-0" /> : null}
        <span className="truncate">{facet.value}</span>
      </span>
      <span className="shrink-0 text-caption text-ink-muted tabular-nums">
        {facet.productCount}
      </span>
    </Link>
  );
}

/**
 * Which values stay in view and which fold away.
 *
 * The largest shelves show, biggest first — those are the ones most shoppers
 * want, and the ERP's alphabetical order would put "Chocolates, 2" ahead of
 * "Grocery, 21". The folded rest keeps the ERP's order, which is the easier one
 * to scan for a name.
 *
 * The selected value always stays in view, even when it is a small shelf that
 * would otherwise fold: a filter that is narrowing the listing must never be
 * hidden behind a disclosure the shopper did not open.
 */
function splitFacets(
  facets: Facet[],
  isSelected: (facet: Facet) => boolean,
): { shown: Facet[]; folded: Facet[] } {
  if (facets.length < VISIBLE + 2) return { shown: facets, folded: [] };

  const largest = [...facets]
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, VISIBLE);
  const shown = [...largest, ...facets.filter((f) => isSelected(f) && !largest.includes(f))];
  const folded = facets.filter((facet) => !shown.includes(facet));

  return { shown, folded };
}
