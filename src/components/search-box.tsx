"use client";

import { useSearchParams } from "next/navigation";

import { Icon } from "@/design-system";

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
 *
 * The magnifier is the submit button, not decoration. Enter is how most people
 * search, but a form needs a control a pointer or a switch can reach too, and
 * the glyph everyone already reads as "search" is the obvious one to press.
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
      className="relative w-full"
    >
      {/* The filters the shopper already chose. A search inside a category
          means both, and dropping one silently would widen their results
          without telling them. */}
      {category ? <input type="hidden" name="category" value={category} /> : null}
      {brand ? <input type="hidden" name="brand" value={brand} /> : null}

      <label className="sr-only" htmlFor="shop-search">
        Search products
      </label>
      <input
        id="shop-search"
        type="search"
        name="q"
        // Uncontrolled and keyed by the current query: `defaultValue` is only
        // read on mount, so keying makes the box follow the URL when a shopper
        // clears a search or presses back.
        key={q}
        defaultValue={q}
        placeholder={category ? `Search in ${category}` : "Search products"}
        autoComplete="off"
        className="h-11 w-full min-w-0 rounded-full border border-line bg-surface-subdued pr-4 pl-11 text-body text-ink placeholder:text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:border-line-strong focus:border-line-active focus:bg-surface focus:ring-1 focus:ring-line-active focus:outline-hidden"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute top-1/2 left-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-surface hover:text-ink-strong"
      >
        <Icon name="search" className="size-[1.125rem]" />
      </button>
    </form>
  );
}
