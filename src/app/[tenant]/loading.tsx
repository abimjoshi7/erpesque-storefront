import { Skeleton } from "@/design-system";

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
 * skeleton was holding instead of shoving the page down.
 */
const PAGE_SIZE = 24;

export default function CatalogLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12" aria-busy="true">
      <div className="mb-10 border-b border-line pb-6">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-32" />
      </div>

      <div className="flex flex-col gap-10 lg:flex-row">
        <aside className="lg:w-48 lg:shrink-0">
          <Skeleton className="h-3 w-20" />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 lg:flex-col">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-24" />
            ))}
          </div>
        </aside>

        <div className="flex-1">
          {/* Decorative: a screen reader is told the region is busy and does not
              need eighteen empty list items read out to it. */}
          <ul
            aria-hidden="true"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: PAGE_SIZE }, (_, index) => (
              <li
                key={index}
                className="flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-xs"
              >
                <Skeleton className="mb-4 aspect-square rounded-md" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-4 h-4 w-20" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <span className="sr-only">Loading products…</span>
    </main>
  );
}
