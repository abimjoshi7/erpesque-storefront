import { parseSort, type CatalogSort } from "@/lib/erp";
import { parseMajorAmount } from "@/lib/money";

/**
 * Everything that narrows or orders a listing, in one shape.
 *
 * The facets, the pagination, the sort menu and the price filter all build
 * links to the same page, and every one of them has to carry the settings it is
 * not itself changing. Before this module each built its own query string, and
 * the bug that produces is silent: click page 2 and the shopper's category
 * survives but their sort quietly reverts, because one builder learned about
 * `sort` and the other did not.
 */
export type ListingFilters = {
  q?: string;
  category?: string;
  brand?: string;
  sort?: CatalogSort;
  /**
   * Inclusive bounds in *major* units — 620, not 62000.
   *
   * The URL is read by people: it is what a shopper sees in the address bar and
   * pastes to a friend, and `?maxPrice=62000` on a Rs 620 filter reads as a
   * typo. Converted to the ERP's minor units once, where the catalog is
   * fetched.
   */
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
};

/** The raw shape a page receives, before any of it is trusted. */
export type RawListingParams = {
  q?: string;
  category?: string;
  brand?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  page?: string;
};

/**
 * Reads the URL into `ListingFilters`, dropping anything malformed.
 *
 * Dropping rather than rejecting: these values arrive from bookmarks, shared
 * links and crawlers, and a shop that renders an error because someone hand-
 * edited `?minPrice=` is worse than one that shows the whole catalog.
 */
export function readFilters(params: RawListingParams): ListingFilters {
  const page = Number(params.page);

  return {
    q: params.q?.trim() || undefined,
    category: params.category || undefined,
    brand: params.brand || undefined,
    sort: parseSort(params.sort),
    minPrice: parseMajorAmount(params.minPrice),
    maxPrice: parseMajorAmount(params.maxPrice),
    // Only the exact string a link of ours emits counts as on, so a stray
    // `?inStock=0` reads as off rather than as "present, therefore true".
    inStock: params.inStock === "true" ? true : undefined,
    page: Number.isSafeInteger(page) && page > 1 ? page : undefined,
  };
}

/**
 * A listing URL carrying every filter.
 *
 * Values equal to their default are left out, so the unfiltered shop is `/shop`
 * rather than `/shop?sort=featured&page=1`. One listing, one URL — which is
 * what keeps the canonical link honest and stops a crawler indexing the same
 * page under six spellings.
 *
 * `page` is deliberately *not* carried by `withFilters`; changing what is being
 * listed has to return to page 1, because page 4 of the old results is usually
 * past the end of the new ones and an empty page reads as a shop with nothing
 * in it.
 */
export function listingHref(tenant: string, filters: ListingFilters): string {
  const search = new URLSearchParams();

  if (filters.q) search.set("q", filters.q);
  if (filters.category) search.set("category", filters.category);
  if (filters.brand) search.set("brand", filters.brand);
  if (filters.sort && filters.sort !== "featured") search.set("sort", filters.sort);
  if (filters.minPrice) search.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice) search.set("maxPrice", String(filters.maxPrice));
  if (filters.inStock) search.set("inStock", "true");
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));

  const query = search.toString();
  return query
    ? `/${encodeURIComponent(tenant)}?${query}`
    : `/${encodeURIComponent(tenant)}`;
}

/**
 * The same listing with one thing changed, back at page 1.
 *
 * Pass `undefined` for a key to clear it — `withFilters(current, { category:
 * undefined })` is the "All categories" link.
 */
export function withFilters(
  current: ListingFilters,
  changes: Partial<ListingFilters>,
): ListingFilters {
  return { ...current, ...changes, page: undefined };
}

/** Whether anything is narrowing the listing — the empty state asks this. */
export function isFiltered(filters: ListingFilters): boolean {
  return Boolean(
    filters.q ||
      filters.category ||
      filters.brand ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.inStock,
  );
}
