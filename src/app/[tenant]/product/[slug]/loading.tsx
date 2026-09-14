import { Container, Skeleton } from "@/design-system";

/**
 * The product page's shape, held while the ERP answers.
 *
 * Its own file rather than inheriting the catalog's: a product is a two-column
 * page, and showing a grid of cards on the way to one would be a worse guess
 * than showing nothing.
 */
export default function ProductLoading() {
  return (
    <main aria-busy="true">
      <Container className="pt-6 pb-16 sm:pt-8 lg:pb-24">
        <Skeleton className="h-4 w-56" />

        <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          <Skeleton className="aspect-square rounded-lg lg:col-span-7" />
          <div className="lg:col-span-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-9 w-4/5" />
            <Skeleton className="mt-5 h-8 w-36" />
            <div className="my-6 h-px bg-line" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-32 rounded-md" />
              <Skeleton className="h-11 flex-1 rounded-md" />
            </div>
            <Skeleton className="mt-8 h-44 w-full rounded-lg" />
          </div>
        </div>
        <span className="sr-only">Loading product…</span>
      </Container>
    </main>
  );
}
