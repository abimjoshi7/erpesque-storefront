import Link from "next/link";

import { Button, Input, Text } from "@/design-system";
import { listingHref, withFilters, type ListingFilters } from "@/lib/catalog-url";
import type { Tenant } from "@/lib/erp";

/**
 * Price range and availability, as a plain `method="get"` form.
 *
 * Submitting produces `/{tenant}?minPrice=100&inStock=true` by itself — no
 * handler, no client component, and the result is a URL a shopper can bookmark
 * or share, the same property the search box and the facets are built for.
 *
 * The filters the form is *not* changing ride along as hidden inputs. Without
 * them, setting a price bound inside a category would silently widen back to
 * the whole shop, which is the kind of thing nobody reports and everybody
 * notices.
 *
 * `page` is deliberately absent: narrowing a listing has to land on page 1,
 * because page 4 of the old results is usually past the end of the new ones.
 */
export function FilterPanel({
  tenant,
  filters,
  currency,
}: {
  tenant: string;
  filters: ListingFilters;
  currency: NonNullable<Tenant["currency"]>;
}) {
  const hasPrice = filters.minPrice !== undefined || filters.maxPrice !== undefined;
  const symbol = currency.symbol ?? currency.code ?? "";

  return (
    <form action={`/${encodeURIComponent(tenant)}`} method="get" className="mt-6">
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.category ? (
        <input type="hidden" name="category" value={filters.category} />
      ) : null}
      {filters.brand ? <input type="hidden" name="brand" value={filters.brand} /> : null}
      {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}

      <fieldset className="border-0 p-0">
        <legend className="text-label font-semibold text-ink-muted uppercase">
          Price ({symbol})
        </legend>

        <div className="mt-2 flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-price">
            Minimum price in {symbol}
          </label>
          <Input
            id="filter-min-price"
            // `inputMode` rather than `type="number"`: a spinner is useless at
            // shelf prices, and number inputs silently discard what they cannot
            // parse — a shopper mid-typing loses the digits they already have.
            type="text"
            inputMode="decimal"
            name="minPrice"
            placeholder="Min"
            defaultValue={filters.minPrice ?? ""}
            autoComplete="off"
            className="w-full py-1.5 text-body-sm tabular-nums"
          />
          <span className="text-ink-muted" aria-hidden="true">
            –
          </span>
          <label className="sr-only" htmlFor="filter-max-price">
            Maximum price in {symbol}
          </label>
          <Input
            id="filter-max-price"
            type="text"
            inputMode="decimal"
            name="maxPrice"
            placeholder="Max"
            defaultValue={filters.maxPrice ?? ""}
            autoComplete="off"
            className="w-full py-1.5 text-body-sm tabular-nums"
          />
        </div>
      </fieldset>

      <label className="mt-4 flex items-center gap-2 text-body-sm text-ink-subdued">
        <input
          type="checkbox"
          name="inStock"
          // The value matters: `readFilters` treats only the literal "true" as
          // on, so an unchecked box sends nothing and a checked one sends the
          // exact string the links emit.
          value="true"
          defaultChecked={filters.inStock ?? false}
          className="size-4 rounded-xs border-line-strong accent-[var(--primary)]"
        />
        In stock only
      </label>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>

        {/* Only offered when there is something to clear. A permanently
            visible "clear" on an unfiltered listing is a control that does
            nothing, which teaches a shopper to ignore it. */}
        {hasPrice || filters.inStock ? (
          <Link
            href={listingHref(
              tenant,
              withFilters(filters, {
                minPrice: undefined,
                maxPrice: undefined,
                inStock: undefined,
              }),
            )}
            className="text-body-sm text-ink-muted underline underline-offset-4 hover:text-ink-strong"
          >
            Clear
          </Link>
        ) : null}
      </div>

      {/* States the active bound in the shop's own currency, because the two
          boxes above show bare numbers and "100 – 500" is ambiguous about
          whether it was applied. */}
      {hasPrice ? (
        <Text variant="caption" tone="muted" className="mt-2 tabular-nums">
          Showing {filters.minPrice ? `${symbol} ${filters.minPrice}` : "any"} to{" "}
          {filters.maxPrice ? `${symbol} ${filters.maxPrice}` : "any"}
        </Text>
      ) : null}
    </form>
  );
}
