import { Container, Skeleton } from "@/design-system";

/**
 * The order page reads live and uncached on every visit — it is personal and it
 * changes as the shop works through the order — so it is the one page here that
 * reliably waits on a round trip. Holding its shape is worth the file.
 */
export default function OrderLoading() {
  return (
    <Container as="main" className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl" aria-busy="true">
        <Skeleton className="mt-4 h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-6 h-16 w-full rounded-lg" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3 rounded-lg border border-line bg-surface p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <span className="sr-only">Loading your order…</span>
      </div>
    </Container>
  );
}
