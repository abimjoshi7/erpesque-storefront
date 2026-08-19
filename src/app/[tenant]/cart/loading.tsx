import { Skeleton } from "@/design-system";

/**
 * Its own file so the cart does not borrow the catalog's skeleton on the way
 * in — a grid of product cards is a worse guess at this page than a blank one.
 *
 * Only the heading is drawn. Everything below it is the shopper's own cart,
 * which lives in localStorage and cannot be guessed at from the server; the
 * client fills it in as soon as it mounts.
 */
export default function CartLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12" aria-busy="true">
      <div className="mb-8 border-b border-line pb-6">
        <Skeleton className="h-8 w-40" />
      </div>
      <span className="sr-only">Loading your cart…</span>
    </main>
  );
}
