import { Skeleton } from "@/design-system";

/**
 * The order page reads live and uncached on every visit — it is personal and it
 * changes as the shop works through the order — so it is the one page here that
 * reliably waits on a round trip. Holding its shape is worth the file.
 */
export default function OrderLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12" aria-busy="true">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-7 w-40 rounded-full" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading your order…</span>
    </main>
  );
}
