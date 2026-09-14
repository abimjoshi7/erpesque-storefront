import { Container, Skeleton } from "@/design-system";

/**
 * The catalog's shape, held while the ERP answers.
 *
 * Shown for every navigation into the shop — a facet click, a page number, a
 * search — because each of those is a fresh server render. Without it the old
 * listing sits there looking clickable while a different one is on its way,
 * which reads as a shop that ignored the tap.
 *
 * The card count matches the catalog's own default page size, and each card
 * matches `ProductCard`'s geometry, so the real listing lands in the space the
 * skeleton was holding instead of shoving the page down. It holds the shape of
 * a narrowed listing rather than the front page's hero, because a facet or a
 * page number — not the front page — is what nearly every wait is for.
 */
const PAGE_SIZE = 24;

export default function CatalogLoading() {
  return (
    <main aria-busy="true">
      <Container className="pt-6 pb-16">
        <div className="border-b border-line pb-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-9 w-72 max-w-full" />
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:mt-8 lg:flex-row lg:gap-10">
          <Skeleton className="h-12 w-full rounded-lg lg:hidden" />

          <aside className="hidden lg:block lg:w-60 lg:shrink-0">
            <Skeleton className="h-4 w-24" />
            <div className="mt-4 flex flex-col gap-3">
              {Array.from({ length: 10 }, (_, index) => (
                <div key={index} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-5" />
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-48 rounded-md" />
            </div>

            {/* Decorative: a screen reader is told the region is busy and does not
                need twenty-four empty list items read out to it. */}
            <ul
              aria-hidden="true"
              className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 xl:grid-cols-4"
            >
              {Array.from({ length: PAGE_SIZE }, (_, index) => (
                <li key={index} className="flex flex-col">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="mt-3 h-3 w-16" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-1.5 h-4 w-2/3" />
                  <Skeleton className="mt-3 h-5 w-20" />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <span className="sr-only">Loading products…</span>
      </Container>
    </main>
  );
}
