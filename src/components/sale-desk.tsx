"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import { CartView, type CheckoutShopper, type RailProduct } from "@/app/[tenant]/cart/cart-view";
import { ProductCard } from "@/components/product-card";
import { useShopper } from "@/components/shopper-provider";
import { Button, Icon, Text, cx } from "@/design-system";
import { useCart } from "@/lib/cart";
import type { Product, ShopperSession, Tenant } from "@/lib/erp";
import { primaryImage } from "@/lib/media";
import { checkoutHref, signInHref } from "@/lib/next-path";

type Currency = NonNullable<Tenant["currency"]>;

const FILTERS_CHANGED = "erpesque:sale-filters";
const SELECTION_CHANGED = "erpesque:sale-selected";

/**
 * `useSyncExternalStore` compares snapshots by identity. Parsing on every read
 * would hand it a new object each time and the rail would re-render forever.
 */
const selectionCache = new Map<string, RailProduct | null>();
const collapsedCache = new Map<string, boolean>();

function subscribeFilters(onChange: () => void): () => void {
  window.addEventListener(FILTERS_CHANGED, onChange);
  return () => window.removeEventListener(FILTERS_CHANGED, onChange);
}

function subscribeSelection(onChange: () => void): () => void {
  window.addEventListener(SELECTION_CHANGED, onChange);
  return () => window.removeEventListener(SELECTION_CHANGED, onChange);
}

function collapsedSnapshot(key: string): boolean {
  const cached = collapsedCache.get(key);
  if (cached !== undefined) return cached;
  let value = false;
  try {
    value = window.sessionStorage.getItem(key) === "1";
  } catch {
    value = false;
  }
  collapsedCache.set(key, value);
  return value;
}

function selectionSnapshot(key: string): RailProduct | null {
  if (selectionCache.has(key)) return selectionCache.get(key) ?? null;
  let value: RailProduct | null = null;
  try {
    value = parseSelection(window.sessionStorage.getItem(key) ?? "");
  } catch {
    value = null;
  }
  selectionCache.set(key, value);
  return value;
}

function rememberCollapsed(key: string, collapsed: boolean) {
  collapsedCache.set(key, collapsed);
  try {
    window.sessionStorage.setItem(key, collapsed ? "1" : "0");
  } catch {
    // The cache still holds the choice for this tab.
  }
  window.dispatchEvent(new Event(FILTERS_CHANGED));
}

function rememberSelection(key: string, product: RailProduct) {
  selectionCache.set(key, product);
  try {
    window.sessionStorage.setItem(key, JSON.stringify(product));
  } catch {
    // The cache still holds the choice for this tab.
  }
  window.dispatchEvent(new Event(SELECTION_CHANGED));
}

function parseSelection(raw: string): RailProduct | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRailProduct(parsed)) return null;
    return { ...parsed, image: typeof parsed.image === "string" ? parsed.image : null };
  } catch {
    return null;
  }
}

/**
 * The shop as one transaction.
 *
 * Filters on the left, collapsible and remembered for the visit. Products in
 * five columns. The order ticket on the right once something is chosen or the
 * cart already holds a line. The product page is not where a card click goes.
 */
export function SaleDesk({
  tenant,
  products,
  currency,
  requireSignIn,
  openCheckout,
  heading,
  filters,
  mobileFilters,
  toolbar,
  activeFilters,
  empty,
  pagination,
}: {
  tenant: string;
  products: Product[];
  currency: Currency | null;
  requireSignIn: boolean;
  /** `?checkout=1`, from the cart route and the header. */
  openCheckout: boolean;
  heading: string;
  filters: ReactNode;
  mobileFilters: ReactNode;
  toolbar: ReactNode;
  activeFilters: ReactNode;
  empty: ReactNode;
  pagination: ReactNode;
}) {
  const { session } = useShopper();
  const { lines, include } = useCart(tenant);

  const collapseKey = `erpesque.sale-filters.${tenant}`;
  const selectionKey = `erpesque.sale-selected.${tenant}`;

  const collapsed = useSyncExternalStore(
    subscribeFilters,
    () => collapsedSnapshot(collapseKey),
    () => false,
  );
  const selection = useSyncExternalStore(
    subscribeSelection,
    () => selectionSnapshot(selectionKey),
    () => null,
  );

  function toggleFilters() {
    rememberCollapsed(collapseKey, !collapsed);
  }

  function choose(product: Product) {
    const next = snapshot(tenant, product);
    rememberSelection(selectionKey, next);
    if (product.availability === "out_of_stock") return;
    if (product.priceMinor == null) return;
    // `null` is signed out; `undefined` is still asking. Neither may fill a
    // cart the checkout would then refuse.
    if (requireSignIn && !session) return;
    include(product.slug);
  }

  const live = selection ? products.find((product) => product.slug === selection.slug) : undefined;
  const shown = live ? snapshot(tenant, live) : selection;
  const showRail = openCheckout || shown !== null || lines.length > 0;

  return (
    <div className="flex flex-col xl:h-[calc(100svh-11rem)] xl:flex-row xl:overflow-hidden">
      {filters ? (
        <aside
          id="sale-filters"
          className={cx(
            "hidden shrink-0 flex-col border-r border-line bg-surface xl:flex",
            collapsed ? "w-auto" : "w-64",
          )}
        >
          <div
            className={cx(
              "flex shrink-0 items-center gap-2",
              collapsed ? "p-2" : "justify-between px-4 py-3",
            )}
          >
            {collapsed ? null : (
              <p className="text-body-sm font-semibold text-ink-strong">Filters</p>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFilters}
              aria-expanded={!collapsed}
              aria-controls="sale-filters"
              icon={
                <Icon
                  name={collapsed ? "chevron-right" : "chevron-left"}
                  className="size-4"
                />
              }
            >
              {collapsed ? "Filters" : "Hide"}
            </Button>
          </div>
          {collapsed ? null : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{filters}</div>
          )}
        </aside>
      ) : null}

      <div className="min-w-0 flex-1 xl:overflow-y-auto">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <Text as="h1" variant="displayMedium" className="text-balance break-words">
            {heading}
          </Text>
          {mobileFilters}
          {toolbar}
          {activeFilters}
          {empty ?? (
            <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <li key={product.slug}>
                  {currency ? (
                    <ProductCard
                      tenant={tenant}
                      product={product}
                      currency={currency}
                      headingAs="h2"
                      selected={shown?.slug === product.slug}
                      onSelect={() => choose(product)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => choose(product)}
                      aria-pressed={shown?.slug === product.slug}
                      className="text-left text-body font-medium text-ink-strong"
                    >
                      {product.title}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pagination}
        </div>
      </div>

      {showRail ? (
        <aside
          aria-label="Order"
          className="w-full shrink-0 border-t border-line xl:w-96 xl:overflow-y-auto xl:border-t-0 xl:border-l"
        >
          <div className="px-4 py-4 sm:px-5">
            <CartView
              tenant={tenant}
              shopper={toCheckoutShopper(session)}
              shopperReady={session !== undefined}
              signInHref={signInHref(tenant, checkoutHref(tenant))}
              requireSignIn={requireSignIn}
              currency={currency}
              selection={shown}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function snapshot(tenant: string, product: Product): RailProduct {
  return {
    slug: product.slug,
    title: product.title,
    category: product.category,
    priceMinor: product.priceMinor,
    availability: product.availability,
    image: primaryImage(tenant, product.images),
  };
}

function isRailProduct(value: unknown): value is RailProduct {
  if (typeof value !== "object" || value === null) return false;
  const { slug, title } = value as Partial<RailProduct>;
  return typeof slug === "string" && slug.length > 0 && typeof title === "string";
}

function toCheckoutShopper(session: ShopperSession | null | undefined): CheckoutShopper | null {
  if (!session) return null;
  const shopper = session.shopper;
  return {
    name: shopper.name ?? null,
    phone: shopper.phone ?? null,
    address: shopper.address ?? null,
    landmark: shopper.landmark ?? null,
  };
}
