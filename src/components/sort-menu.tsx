import Link from "next/link";

import { Icon, cx } from "@/design-system";
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
    <details className="group relative shrink-0">
      <summary
        className={cx(
          "flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-line-strong",
          "bg-surface px-3.5 text-body-sm text-ink-strong shadow-xs",
          "transition-colors duration-(--duration-fast) ease-standard hover:border-line-active",
          // Safari draws its own triangle on a summary and ignores list-style.
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="text-ink-subdued">Sort by</span>
        <span className="font-semibold">{LABELS[current]}</span>
        <Icon
          name="chevron-down"
          className="size-4 text-ink-muted transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180"
        />
      </summary>

      <ul
        className={cx(
          "absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-lg border border-line",
          "bg-surface-elevated p-1 shadow-lg",
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
                  "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-body-sm",
                  isCurrent
                    ? "bg-surface-subdued font-semibold text-ink-strong"
                    : "text-ink-subdued hover:bg-surface-subdued hover:text-ink-strong",
                )}
              >
                {LABELS[sort]}
                {isCurrent ? <Icon name="check" className="size-4" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
