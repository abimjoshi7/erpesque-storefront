import { Skeleton } from "@/design-system";

/**
 * The product page's shape, held while the ERP answers.
 *
 * Its own file rather than inheriting the catalog's: a product is a two-column
 * page, and showing a grid of cards on the way to one would be a worse guess
 * than showing nothing.
 */
export default function ProductLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" aria-busy="true">
      <Skeleton className="h-4 w-48" />

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-lg" />
        <div>
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="mt-6 h-7 w-32" />
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="mt-8 h-10 w-32 rounded-md" />
        </div>
      </div>
      <span className="sr-only">Loading product…</span>
    </main>
  );
}
