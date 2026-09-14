import Link from "next/link";
import { Suspense } from "react";

import { AccountLink } from "@/components/account-link";
import { CartLink } from "@/components/cart-link";
import { SearchBox } from "@/components/search-box";
import { ShopNav, ShopNavView, type CategoryLink } from "@/components/shop-nav";
import { shopShortcuts } from "@/components/shop-shortcuts";
import { ShopWordmark } from "@/components/shop-wordmark";
import { Container, Icon, Skeleton } from "@/design-system";

/**
 * The bar every page of a shop carries: whose shop it is, a way to search it,
 * a way to the cart, and a way onto the shelves.
 *
 * Lives in the shop layout rather than in each page, so navigating from the
 * catalog to a product to the cart does not tear the header down and rebuild
 * it — the cart count in particular stays mounted, and stops flickering back to
 * nothing on every navigation.
 *
 * Three bands, and only the middle one sticks. The note above it says the same
 * thing on every page and can scroll away; the nav row is a way in, not a
 * control a shopper needs mid-page. What stays is search and the cart — the two
 * things someone scrolling a long listing reaches for. Returned as siblings
 * rather than wrapped, because a sticky element only sticks within its parent,
 * and a wrapper exactly its own height would give it nowhere to go.
 *
 * `SearchBox` and `ShopNav` read the URL's query string, which suspends during
 * prerendering; the boundaries here are what keep that from forcing the whole
 * layout to render in the browser.
 *
 * `AccountLink` is a client island for a related reason: it needs to know who
 * is signed in, and reading the session cookie here instead would make every
 * page under `/{tenant}` render per request.
 */
export function ShopHeader({
  tenant,
  shopName,
  categories,
}: {
  tenant: string;
  shopName: string;
  categories: CategoryLink[];
}) {
  const home = `/${encodeURIComponent(tenant)}`;
  const shortcuts = shopShortcuts(tenant);

  return (
    <>
      {/* One line, and only what holds on every shop. Sign-in by code is not
          on it: a shop whose `signInWith` is empty cannot send a code, and
          this layout's hour-old tenant is the wrong thing to decide that by. */}
      <div className="border-b border-line-subtle bg-surface-subdued text-caption text-ink-subdued">
        <Container className="flex min-h-9 items-center justify-center py-2">
          <p className="flex items-center gap-2">
            <Icon name="cash" className="size-4 text-ink-muted" />
            Order online, pay when it arrives
          </p>
        </Container>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <Container className="flex flex-wrap items-center gap-x-6 gap-y-2.5 py-2.5 lg:flex-nowrap lg:py-3">
          <Link href={home} className="min-w-0 rounded-md" aria-label={`${shopName} home`}>
            <ShopWordmark name={shopName} />
          </Link>

          {/* Its own row on a phone, where there is no room beside the name,
              and the widest thing in the bar on a desktop. */}
          <div className="order-last w-full lg:order-none lg:flex-1">
            <div className="lg:max-w-2xl">
              <Suspense fallback={<SearchBoxFallback />}>
                <SearchBox tenant={tenant} />
              </Suspense>
            </div>
          </div>

          <nav aria-label="Account and cart" className="ml-auto flex items-center gap-1">
            <AccountLink tenant={tenant} />
            <CartLink tenant={tenant} />
          </nav>
        </Container>
      </header>

      <div className="border-b border-line bg-surface">
        <Container>
          <Suspense
            fallback={
              <ShopNavView allHref={home} categories={categories} shortcuts={shortcuts} />
            }
          >
            <ShopNav
              tenant={tenant}
              allHref={home}
              categories={categories}
              shortcuts={shortcuts}
            />
          </Suspense>
        </Container>
      </div>
    </>
  );
}

/**
 * Holds the search box's space while the query string resolves. Same height and
 * shape rather than a spinner, so the header does not jump when the real one
 * arrives a frame later.
 */
function SearchBoxFallback() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}
