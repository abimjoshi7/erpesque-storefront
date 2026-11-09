import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FacetNav } from "@/components/facet-nav";
import { FilterPanel } from "@/components/filter-panel";
import { SaleDesk } from "@/components/sale-desk";
import { SortMenu } from "@/components/sort-menu";
import { ButtonLink, EmptyState, Icon, Text, cx } from "@/design-system";
import {
  isFiltered,
  listingHref,
  readFilters,
  withFilters,
  type ListingFilters,
  type RawListingParams,
} from "@/lib/catalog-url";
import { fetchCatalog, fetchFacets, type Facets, type Tenant } from "@/lib/erp";
import { majorToMinor } from "@/lib/money";

type PageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<RawListingParams & { checkout?: string }>;
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
  const raw = await searchParams;
  const filters = readFilters(raw);
  const openCheckout = raw.checkout === "1";

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
  const first = (catalog.page - 1) * catalog.pageSize + 1;
  const last = first + products.length - 1;
  const narrowing = activeFilterCount(filters);

  return (
    <main>
      <SaleDesk
        tenant={tenant}
        products={products}
        currency={shop.currency ?? null}
        requireSignIn={shop.requireSignIn}
        openCheckout={openCheckout}
        heading={headingFor(filters)}
        filters={
          facets ? (
            <CatalogFilters
              key="desktop-filters"
              tenant={tenant}
              facets={facets}
              filters={filters}
              idPrefix="filter"
            />
          ) : null
        }
        mobileFilters={
          facets ? (
            <details
              key="mobile-filters"
              className="group mt-4 rounded-lg border border-line bg-surface shadow-xs xl:hidden"
            >
              <summary
                key="filters-summary"
                className={cx(
                  "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3",
                  "text-body-sm font-semibold text-ink-strong",
                  "[&::-webkit-details-marker]:hidden",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon name="sliders" className="size-4" />
                  Filters
                  {narrowing ? (
                    <span className="rounded-full bg-ink-strong px-1.5 text-label text-surface tabular-nums">
                      {narrowing}
                    </span>
                  ) : null}
                </span>
                <Icon
                  name="chevron-down"
                  className="size-4 text-ink-muted transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180"
                />
              </summary>
              <div key="filters-panel" className="border-t border-line px-4 py-5">
                <CatalogFilters
                  tenant={tenant}
                  facets={facets}
                  filters={filters}
                  idPrefix="filter-mobile"
                />
              </div>
            </details>
          ) : null
        }
        toolbar={
          products.length > 0 ? (
            <div key="toolbar" className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Text key="count" variant="bodySmall" tone="subdued" className="tabular-nums">
                {catalog.totalPages > 1 ? (
                  <>
                    Showing {first}–{last} of {catalog.total} products
                  </>
                ) : (
                  <>
                    {catalog.total} {catalog.total === 1 ? "product" : "products"}
                  </>
                )}
              </Text>
              {catalog.total > 1 ? (
                <SortMenu key="sort" tenant={tenant} filters={filters} />
              ) : null}
            </div>
          ) : null
        }
        activeFilters={
          <ActiveFilters
            key="active-filters"
            tenant={tenant}
            filters={filters}
            currency={shop.currency}
          />
        }
        empty={
          products.length === 0 ? (
            <EmptyState
              className="mt-2"
              icon={<Icon name={isFiltered(filters) ? "search" : "package"} className="size-8" />}
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
          ) : null
        }
        pagination={
          <Pagination
            key="pagination"
            tenant={tenant}
            page={catalog.page}
            totalPages={catalog.totalPages}
            filters={filters}
          />
        }
      />
    </main>
  );
}

/** The facets and the price form, stacked — one copy per breakpoint. */
function CatalogFilters({
  tenant,
  facets,
  filters,
  idPrefix,
}: {
  tenant: string;
  facets: Facets;
  filters: ListingFilters;
  idPrefix: string;
}) {
  const hasFacets = facets.categories.length > 0 || facets.brands.length > 0;

  return (
    <div className="flex flex-col">
      <FacetNav key="facets" tenant={tenant} facets={facets} current={filters} />
      <FilterPanel
        key="price"
        tenant={tenant}
        filters={filters}
        currency={facets.tenant.currency}
        idPrefix={idPrefix}
        className={hasFacets ? "border-t border-line pt-5" : undefined}
      />
    </div>
  );
}

/**
 * What is narrowing the listing, each with its own way out.
 *
 * The sidebar already shows the selected facet, but on a phone the sidebar is
 * folded away — without these a shopper who filtered to Beverage and then
 * searched has no visible sign the search is only looking inside Beverage.
 */
function ActiveFilters({
  tenant,
  filters,
  currency,
}: {
  tenant: string;
  filters: ListingFilters;
  currency: Tenant["currency"];
}) {
  const symbol = currency?.symbol ?? currency?.code ?? "";
  const chips: Array<{ kind: string; value: string; href: string }> = [];

  if (filters.q) {
    chips.push({
      kind: "Search",
      value: `“${filters.q}”`,
      href: listingHref(tenant, withFilters(filters, { q: undefined })),
    });
  }
  if (filters.category) {
    chips.push({
      kind: "Category",
      value: filters.category,
      href: listingHref(tenant, withFilters(filters, { category: undefined })),
    });
  }
  if (filters.brand) {
    chips.push({
      kind: "Brand",
      value: filters.brand,
      href: listingHref(tenant, withFilters(filters, { brand: undefined })),
    });
  }
  if (filters.minPrice || filters.maxPrice) {
    const { minPrice, maxPrice } = filters;
    chips.push({
      kind: "Price",
      value:
        minPrice && maxPrice
          ? `${symbol} ${minPrice} – ${symbol} ${maxPrice}`
          : minPrice
            ? `From ${symbol} ${minPrice}`
            : `Up to ${symbol} ${maxPrice}`,
      href: listingHref(
        tenant,
        withFilters(filters, { minPrice: undefined, maxPrice: undefined }),
      ),
    });
  }
  if (filters.inStock) {
    chips.push({
      kind: "Availability",
      value: "In stock only",
      href: listingHref(tenant, withFilters(filters, { inStock: undefined })),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Text as="h2" variant="bodySmall" className="sr-only">
        Active filters
      </Text>
      <ul className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <li key={chip.kind}>
            <Link
              href={chip.href}
              aria-label={`Remove ${chip.kind.toLowerCase()} filter: ${chip.value}`}
              className={cx(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface py-1 pr-2 pl-3",
                "text-body-sm text-ink-strong transition-colors duration-(--duration-fast) ease-standard",
                "hover:border-line-active hover:bg-surface-subdued",
              )}
            >
              <span className="text-ink-muted">{chip.kind}:</span>
              <span className="truncate font-medium">{chip.value}</span>
              <Icon name="x" className="size-3.5 shrink-0 text-ink-subdued" />
            </Link>
          </li>
        ))}
      </ul>
      {chips.length > 1 ? (
        <Link
          // Keeps the ordering, which is a preference rather than a narrowing —
          // the same rule the empty state's way out follows.
          href={listingHref(tenant, { sort: filters.sort })}
          className="px-1 text-body-sm font-medium text-ink-subdued underline underline-offset-4 hover:text-ink-strong"
        >
          Clear all
        </Link>
      ) : null}
    </div>
  );
}

/** How many filters are narrowing the listing, for the phone's Filters count. */
function activeFilterCount(filters: ListingFilters): number {
  return [
    filters.category,
    filters.brand,
    filters.minPrice || filters.maxPrice,
    filters.inStock,
  ].filter(Boolean).length;
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
      className="mt-14 flex items-center justify-between gap-2 border-t border-line pt-6"
      aria-label="Pagination"
    >
      <PageStep href={page > 1 ? href(page - 1) : null} direction="previous" />

      <ol className="flex items-center gap-1">
        {pageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="w-6 text-center text-ink-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={href(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cx(
                  "flex size-9 items-center justify-center rounded-md text-body-sm font-semibold tabular-nums sm:size-10",
                  "transition-colors duration-(--duration-fast) ease-standard",
                  item === page
                    ? "bg-ink-strong text-surface"
                    : "text-ink-subdued hover:bg-surface-subdued hover:text-ink-strong",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>

      <PageStep href={page < totalPages ? href(page + 1) : null} direction="next" />
    </nav>
  );
}

function PageStep({
  href,
  direction,
}: {
  href: string | null;
  direction: "previous" | "next";
}) {
  const label = direction === "previous" ? "Previous" : "Next";
  const icon = direction === "previous" ? "chevron-left" : "chevron-right";
  const look =
    "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-body-sm font-semibold";

  // Held in place rather than dropped at the ends, so the page numbers stay
  // centred and the Next button does not jump sideways on the last page.
  if (!href) {
    return (
      <span aria-hidden="true" className={cx(look, "border-line text-ink-disabled")}>
        {direction === "previous" ? <Icon name={icon} className="size-4" /> : null}
        <span className="hidden sm:inline">{label}</span>
        {direction === "next" ? <Icon name={icon} className="size-4" /> : null}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={direction === "previous" ? "prev" : "next"}
      aria-label={`${label} page`}
      className={cx(
        look,
        "border-line-strong bg-surface text-ink-strong shadow-xs",
        "transition-colors duration-(--duration-fast) ease-standard hover:border-line-active",
      )}
    >
      {direction === "previous" ? <Icon name={icon} className="size-4" /> : null}
      <span className="hidden sm:inline">{label}</span>
      {direction === "next" ? <Icon name={icon} className="size-4" /> : null}
    </Link>
  );
}

/**
 * Which page numbers to print: the first, the last, and the current one with a
 * neighbour either side, with an ellipsis for each run that is left out.
 *
 * A gap of exactly one page prints that page instead of an ellipsis — "1 … 3"
 * would hide a single number behind a symbol that takes the same room.
 */
function pageWindow(page: number, totalPages: number): Array<number | "gap"> {
  const shown = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "gap"> = [];
  shown.forEach((n, index) => {
    const previous = shown[index - 1];
    if (previous !== undefined && n - previous === 2) items.push(n - 1);
    else if (previous !== undefined && n - previous > 2) items.push("gap");
    items.push(n);
  });
  return items;
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
