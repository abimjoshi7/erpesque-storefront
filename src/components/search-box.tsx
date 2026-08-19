"use client";

import { useSearchParams } from "next/navigation";

import { Button, Input } from "@/design-system";

/**
 * Search over the shop's catalog.
 *
 * A plain `method="get"` form, not an onChange handler firing fetches. The
 * browser turns it into `/{tenant}?q=rice` by itself, which means it works
 * before hydration and before JavaScript at all, and the result is a real URL a
 * shopper can bookmark or share — the same reason the facets and the pagination
 * are links rather than client state.
 *
 * Client-side only for `useSearchParams`, which is the one thing a server
 * component cannot do here: the box lives in the shop layout, and a layout is
 * not given the search params it must echo back. Without them a search would
 * empty its own box on submit and quietly drop whichever category the shopper
 * had narrowed to.
 */
export function SearchBox({ tenant }: { tenant: string }) {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category");
  const brand = params.get("brand");

  return (
    <form
      // Submitting always lands on page 1 — `page` is deliberately not carried
      // through, because page 4 of the old results is past the end of the new
      // ones, and an empty page reads as a shop with nothing in it.
      action={`/${encodeURIComponent(tenant)}`}
      method="get"
      role="search"
      className="flex w-full items-center gap-2 sm:max-w-xs"
    >
      {/* The filters the shopper already chose. A search inside a category
          means both, and dropping one silently would widen their results
          without telling them. */}
      {category ? <input type="hidden" name="category" value={category} /> : null}
      {brand ? <input type="hidden" name="brand" value={brand} /> : null}

      <label className="sr-only" htmlFor="shop-search">
        Search products
      </label>
      <Input
        id="shop-search"
        type="search"
        name="q"
        // Uncontrolled and keyed by the current query: `defaultValue` is only
        // read on mount, so keying makes the box follow the URL when a shopper
        // clears a search or presses back.
        key={q}
        defaultValue={q}
        placeholder="Search products"
        autoComplete="off"
        className="flex-1 py-1.5"
      />
      <Button type="submit" variant="secondary" size="sm" className="shrink-0">
        Search
      </Button>
    </form>
  );
}
