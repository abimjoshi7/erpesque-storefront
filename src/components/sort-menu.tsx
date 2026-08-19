import Link from "next/link";

import { cx } from "@/design-system";
import { listingHref, withFilters, type ListingFilters } from "@/lib/catalog-url";
import { CATALOG_SORTS, type CatalogSort } from "@/lib/erp";

/**
 * What each ordering is called where a shopper can read it.
 *
 * Not the wire names: `price_asc` is a contract with the ERP, "Price: low to
 * high" is a sentence. Keeping the two apart means the menu can be reworded
 * without touching a query string that is already in someone's bookmarks.
 */
const LABELS: Record<CatalogSort, string> = {
  featured: "Featured",
  newest: "New arrivals",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  name_asc: "Name: A to Z",
  name_desc: "Name: Z to A",
};

/**
 * Sort control, built from links inside a native disclosure.
 *
 * A `<details>` and six `<a>`s rather than a `<select>` with an onChange
 * handler: this works before hydration and with JavaScript switched off, every
 * ordering is a real URL a shopper can share, and the open/close behaviour and
 * keyboard handling come from the browser rather than from code here that would
 * have to reimplement Escape, focus and the outside click.
 *
 * The links carry the whole filter set, so choosing an ordering keeps the
 * shopper's search and facets — and drops them back to page 1, because page 4
 * of the old ordering is a different set of products entirely.
 */
export function SortMenu({
  tenant,
  filters,
}: {
  tenant: string;
  filters: ListingFilters;
}) {
  const current = filters.sort ?? "featured";

  return (
    <details className="relative shrink-0">
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center gap-2 rounded-md border border-line-strong",
          "bg-secondary px-3 py-1.5 text-body-sm font-semibold text-ink-strong shadow-xs",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-secondary-pressed",
          // Safari draws its own triangle on a summary and ignores list-style.
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="text-ink-subdued">Sort</span>
        {LABELS[current]}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-ink-muted"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <ul
        className={cx(
          "absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-md border border-line",
          "bg-surface-elevated py-1 shadow-lg",
        )}
      >
        {CATALOG_SORTS.map((sort) => {
          const isCurrent = sort === current;
          return (
            <li key={sort}>
              <Link
                href={listingHref(tenant, withFilters(filters, { sort }))}
                // `aria-current` rather than a visual tick alone: the check mark
                // beside the active row is decorative and hidden from the
                // accessibility tree, so this is what actually announces it.
                aria-current={isCurrent ? "true" : undefined}
                className={cx(
                  "flex items-center justify-between gap-2 px-3 py-2 text-body-sm",
                  isCurrent
                    ? "font-semibold text-ink-strong"
                    : "text-ink-subdued hover:bg-surface-subdued hover:text-ink-strong",
                )}
              >
                {LABELS[sort]}
                {isCurrent ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
