import { Container, Skeleton } from "@/design-system";

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
    <Container as="main" className="py-8 sm:py-12">
      <div aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-9 w-48" />
        <span className="sr-only">Loading your cart…</span>
      </div>
    </Container>
  );
}
