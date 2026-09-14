import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { FacetNav } from "@/components/facet-nav";
import { FilterPanel } from "@/components/filter-panel";
import { ProductCard } from "@/components/product-card";
import { SortMenu } from "@/components/sort-menu";
import {
  Breadcrumbs,
  ButtonLink,
  Container,
  EmptyState,
  Icon,
  Skeleton,
  Text,
  cx,
} from "@/design-system";
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
  searchParams: Promise<RawListingParams>;
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
  const filters = readFilters(await searchParams);

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

  // The front door gets a hero; every narrowed, reordered or paged view of the
  // same listing does not. A shopper who has already chosen a category or a
  // sort came for the products, and pushing them below a banner a second time
  // is a scroll they did not ask for.
  const isFrontPage =
    !isFiltered(filters) && !filters.page && !filters.sort && products.length > 0;

  const listing = (
    <Listing
      tenant={tenant}
      filters={filters}
      facets={facets}
      catalog={catalog}
      headingAs={isFrontPage ? "h3" : "h2"}
    />
  );

  if (isFrontPage) {
    return (
      <main>
        <CatalogHero
          shopName={shop.name}
          total={catalog.total}
          categoryCount={facets?.categories.length ?? 0}
        />
        {/* Two shelves the listing below cannot show at a glance, each streamed
            on its own so a slow read holds up neither the hero nor the grid. */}
        {shop.currency ? (
          <Container className="flex flex-col gap-12 py-10 sm:gap-14 sm:py-12">
            <Suspense fallback={<RailSkeleton />}>
              <ProductRail
                tenant={tenant}
                id="new-arrivals"
                heading="New arrivals"
                description="The latest additions to the shop."
                href={listingHref(tenant, { sort: "newest" })}
                query={{ sort: "newest" }}
                currency={shop.currency}
              />
            </Suspense>
            <Suspense fallback={<RailSkeleton />}>
              <ProductRail
                tenant={tenant}
                id="lowest-prices"
                heading="Lowest prices"
                description="In stock now, cheapest first."
                href={listingHref(tenant, { sort: "price_asc", inStock: true })}
                query={{ sort: "price_asc", inStock: true }}
                currency={shop.currency}
              />
            </Suspense>
          </Container>
        ) : null}
        <section id="products" aria-labelledby="products-heading" className="scroll-mt-40">
          <Container className="pt-4 pb-16 sm:pt-6">
            <div className="border-b border-line pb-5">
              {/* The shop's own name is the hero's job here. This heading
                  describes the listing beneath it, the same job the h1 does on
                  every filtered view of it. */}
              <Text as="h2" id="products-heading" variant="displayMedium">
                {headingFor(filters)}
              </Text>
            </div>
            {listing}
          </Container>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Container className="pt-6 pb-16">
        <div className="border-b border-line pb-6">
          <Breadcrumbs items={crumbsFor(tenant, filters)} />
          {/* The shop's own name is the header's job. This heading describes the
              listing instead, so a filtered page says what it is filtered to
              rather than repeating the shop name at every URL. */}
          {/* `break-words` for the categories merchants name as one unbroken
              word, which would otherwise run off a phone screen. */}
          <Text as="h1" variant="displayLarge" className="mt-3 text-balance break-words">
            {headingFor(filters)}
          </Text>
        </div>
        {listing}
      </Container>
    </main>
  );
}

/**
 * Sidebar, toolbar, grid and pagination — the part of the page every view of
 * the listing shares, hero or not.
 */
function Listing({
  tenant,
  filters,
  facets,
  catalog,
  headingAs,
}: {
  tenant: string;
  filters: ListingFilters;
  facets: Facets | null;
  catalog: NonNullable<Awaited<ReturnType<typeof fetchCatalog>>>;
  headingAs: "h2" | "h3";
}) {
  const { products, tenant: shop } = catalog;
  const first = (catalog.page - 1) * catalog.pageSize + 1;
  const last = first + products.length - 1;
  const narrowing = activeFilterCount(filters);

  return (
    <div className="mt-6 flex flex-col gap-6 lg:mt-8 lg:flex-row lg:gap-10">
      {facets ? (
        <>
          {/* Rendered twice rather than moved with CSS. A closed `<details>`
              hides its contents whatever the stylesheet says, so the one
              disclosure cannot also be the always-open desktop sidebar; each
              copy is `display: none` at the other width, which also keeps the
              hidden one out of the accessibility tree. */}
          <details className="group rounded-lg border border-line bg-surface shadow-xs lg:hidden">
            <summary
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
            <div className="border-t border-line px-4 py-5">
              <CatalogFilters
                tenant={tenant}
                facets={facets}
                filters={filters}
                idPrefix="filter-mobile"
              />
            </div>
          </details>

          <aside aria-label="Filters" className="hidden lg:block lg:w-60 lg:shrink-0">
            <CatalogFilters tenant={tenant} facets={facets} filters={filters} idPrefix="filter" />
          </aside>
        </>
      ) : null}

      <div className="min-w-0 flex-1">
        {products.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text variant="bodySmall" tone="subdued" className="tabular-nums">
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

            {/* Offered only once there is more than one product to reorder.
                Sorting a single product is a control that changes nothing. */}
            {catalog.total > 1 ? <SortMenu tenant={tenant} filters={filters} /> : null}
          </div>
        ) : null}

        <ActiveFilters tenant={tenant} filters={filters} currency={shop.currency} />

        {products.length === 0 ? (
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
            // A dead end is where shoppers leave. When something was
            // filtering the listing, the way out of the empty page is the
            // unfiltered one — keeping the ordering they chose, which is a
            // preference rather than a narrowing.
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
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <li key={product.slug}>
                <ProductCard
                  tenant={tenant}
                  product={product}
                  currency={shop.currency!}
                  headingAs={headingAs}
                />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          tenant={tenant}
          page={catalog.page}
          totalPages={catalog.totalPages}
          filters={filters}
        />
      </div>
    </div>
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
      <FacetNav tenant={tenant} facets={facets} current={filters} />
      <FilterPanel
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
 * The front page's opening: whose shop this is, how much of it there is, and
 * how buying from it works.
 *
 * Words rather than a photograph because nothing in the ERP is a banner image,
 * and stock art of somebody else's groceries would be the first untrue thing a
 * shopper saw. Everything said here is a fact the page already holds — the
 * counts come from the catalog and the facets, and payment on delivery is how
 * every order through this storefront is settled.
 */
function CatalogHero({
  shopName,
  total,
  categoryCount,
}: {
  shopName: string;
  total: number;
  categoryCount: number;
}) {
  return (
    <section
      aria-labelledby="catalog-hero-heading"
      className="relative overflow-hidden border-b border-line bg-surface"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--accent-soft),transparent_60%)]"
      />
      <Container className="relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_22rem] lg:py-20">
        <div className="max-w-2xl">
          <Text
            variant="labelMedium"
            tone="subdued"
            className="flex items-center gap-2 tracking-wide uppercase"
          >
            <Icon name="store" className="size-4" />
            Online shop
          </Text>
          <Text
            as="h1"
            id="catalog-hero-heading"
            variant="display"
            className="mt-4 text-balance"
          >
            Everything {shopName} sells, in one place.
          </Text>
          <Text variant="bodyLarge" tone="subdued" className="mt-4 max-w-xl text-pretty">
            Browse {total} {total === 1 ? "product" : "products"}
            {categoryCount > 1 ? ` across ${categoryCount} categories` : ""}, and
            order in a few taps.
          </Text>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {/* One call to action. "New arrivals" is already a header shortcut
                and the first shelf below, and a third copy of it here was the
                kind of repetition this page was cut back to avoid. */}
            <ButtonLink href="#products" size="lg">
              Shop all products
              <Icon name="arrow-right" className="size-4" />
            </ButtonLink>
          </div>
        </div>

        <ol className="hidden flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-md lg:flex">
          <HowItWorksStep icon="bag" title="Add what you need">
            Search by name, or browse by category and brand.
          </HowItWorksStep>
          <HowItWorksStep icon="check" title="Place your order">
            No card needed at checkout.
          </HowItWorksStep>
          <HowItWorksStep icon="cash" title="Pay on delivery">
            Settle up when your order reaches you.
          </HowItWorksStep>
        </ol>
      </Container>
    </section>
  );
}

function HowItWorksStep({
  icon,
  title,
  children,
}: {
  icon: "bag" | "check" | "cash";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-ink-strong">
        <Icon name={icon} className="size-5" />
      </span>
      <span>
        <span className="block text-title font-semibold text-ink-strong">{title}</span>
        <span className="mt-0.5 block text-body-sm text-ink-subdued">{children}</span>
      </span>
    </li>
  );
}

/** Products a front-page shelf shows: one desktop row, two rows of two on a phone. */
const RAIL_SIZE = 4;

/**
 * One front-page shelf: a few products from one ordering of the catalog, and
 * the way to the whole of it.
 *
 * These replace a grid of category tiles that repeated the header's category
 * menu and the sidebar a third time. What a shopper cannot get from those is
 * *which* products — what just arrived, and what costs least — so that is what
 * the front page offers before the full listing.
 *
 * The same one-minute cached listing read the catalog makes, asked for twice
 * the shelf so a full row survives the filtering below. Only products with a
 * real price appear: an unpriced item cannot be ordered, and the ERP publishes
 * a zero-priced "Delivery Charge" line that would otherwise lead the cheapest
 * shelf as though it were a bargain.
 *
 * A failure renders nothing rather than throwing, for the reason the product
 * page's neighbours do: the listing beneath has its own read, and a shopper
 * should not be shown the error page because a shelf above it hiccuped.
 */
async function ProductRail({
  tenant,
  id,
  heading,
  description,
  href,
  query,
  currency,
}: {
  tenant: string;
  id: string;
  heading: string;
  description: string;
  href: string;
  query: Pick<NonNullable<Parameters<typeof fetchCatalog>[1]>, "sort" | "inStock">;
  currency: NonNullable<Tenant["currency"]>;
}) {
  let catalog: Awaited<ReturnType<typeof fetchCatalog>> = null;
  try {
    catalog = await fetchCatalog(tenant, { ...query, limit: RAIL_SIZE * 2 });
  } catch {
    return null;
  }

  const products = (catalog?.products ?? [])
    .filter((product) => (product.priceMinor ?? 0) > 0)
    .slice(0, RAIL_SIZE);
  if (products.length === 0) return null;

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-40">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Text as="h2" id={`${id}-heading`} variant="displayMedium">
            {heading}
          </Text>
          <Text variant="bodySmall" tone="subdued" className="mt-1">
            {description}
          </Text>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-ink-strong hover:underline hover:underline-offset-4"
        >
          View all
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard
              tenant={tenant}
              product={product}
              currency={currency}
              headingAs="h3"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A shelf's shape while its read is in flight, so the grid below does not jump. */
function RailSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-56 max-w-full" />
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: RAIL_SIZE }, (_, index) => (
          <li key={index} className="flex flex-col">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="mt-3 h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-3 h-5 w-20" />
          </li>
        ))}
      </ul>
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
 * Where this listing sits in the shop, for the breadcrumb trail.
 *
 * A brand inside a category keeps the category as a step back, because that is
 * the shelf the shopper narrowed from.
 */
function crumbsFor(
  tenant: string,
  { q, category, brand }: ListingFilters,
): Array<{ label: string; href?: string }> {
  const home = { label: "Home", href: `/${encodeURIComponent(tenant)}` };
  if (q) return [home, { label: "Search results" }];
  if (category && brand) {
    return [
      home,
      { label: category, href: listingHref(tenant, { category }) },
      { label: brand },
    ];
  }
  if (category || brand) return [home, { label: (category ?? brand)! }];
  return [home, { label: "All products" }];
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
