import Link from "next/link";
import { Suspense } from "react";

import { AccountLink } from "@/components/account-link";
import { CartLink } from "@/components/cart-link";
import { SearchBox } from "@/components/search-box";
import { Container, Skeleton } from "@/design-system";

/**
 * The bar every page of a shop carries: whose shop it is, a way to search it,
 * and a way to the cart.
 *
 * Lives in the shop layout rather than in each page, so navigating from the
 * catalog to a product to the cart does not tear the header down and rebuild
 * it — the cart count in particular stays mounted, and stops flickering back to
 * nothing on every navigation.
 *
 * `SearchBox` reads the URL's query string, which suspends during
 * prerendering; the boundary here is what keeps that from forcing the whole
 * layout to render in the browser.
 *
 * `AccountLink` is a client island for a related reason: it needs to know who
 * is signed in, and reading the session cookie here instead would make every
 * page under `/{tenant}` render per request.
 */
export function ShopHeader({ tenant, shopName }: { tenant: string; shopName: string }) {
  return (
    <header className="border-b border-line bg-surface">
      <Container className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline justify-between gap-4">
          <Link
            href={`/${encodeURIComponent(tenant)}`}
            className="text-h3 font-bold text-ink-strong"
          >
            {shopName}
          </Link>
          {/* Doubled on small screens: the cart belongs beside the shop name
              when the search box is stacked below both, and beside the search
              box when everything is on one line. */}
          <span className="sm:hidden">
            <CartLink tenant={tenant} />
          </span>
        </div>

        <div className="flex items-center gap-4 sm:justify-end">
          <Suspense fallback={<SearchBoxFallback />}>
            <SearchBox tenant={tenant} />
          </Suspense>
          <AccountLink tenant={tenant} />
          <span className="hidden sm:inline">
            <CartLink tenant={tenant} />
          </span>
        </div>
      </Container>
    </header>
  );
}

/**
 * Holds the search box's space while the query string resolves. Same height and
 * the same disabled control rather than a spinner, so the header does not jump
 * when the real one arrives a frame later.
 */
function SearchBoxFallback() {
  return (
    <div className="flex w-full items-center gap-2 sm:max-w-xs" aria-hidden="true">
      <Skeleton className="h-9 min-w-0 flex-1 rounded-md" />
      <Skeleton className="h-8 w-[78px] shrink-0 rounded-sm" />
    </div>
  );
}
