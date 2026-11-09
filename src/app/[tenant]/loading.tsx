import { Skeleton } from "@/design-system";

/**
 * The sale desk's shape, held while the ERP answers.
 *
 * Shown for every navigation into the shop — a facet click, a page number, a
 * search — because each of those is a fresh server render. Without it the old
 * listing sits there looking clickable while a different one is on its way,
 * which reads as a shop that ignored the tap.
 *
 * The card count matches the catalog's own default page size, and each card
 * matches `ProductCard`'s geometry, so the real listing lands in the space the
 * skeleton was holding instead of shoving the page down.
 */
const PAGE_SIZE = 24;

export default function CatalogLoading() {
  return (
    <main aria-busy="true" className="xl:h-[calc(100svh-11rem)]">
      <div className="flex h-full flex-col xl:flex-row">
        <aside className="hidden w-64 shrink-0 border-r border-line px-4 py-4 xl:block">
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

        <div className="min-w-0 flex-1 px-4 py-4 sm:px-6">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="mt-4 h-12 w-full rounded-lg xl:hidden" />
          <div className="mt-4 flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-48 rounded-md" />
          </div>

          {/* Decorative: a screen reader is told the region is busy and does not
              need twenty-four empty list items read out to it. */}
          <ul
            aria-hidden="true"
            className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5"
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
    </main>
  );
}
