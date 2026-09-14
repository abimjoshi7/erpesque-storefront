import { Container, Skeleton, Text } from "@/design-system";

/**
 * Holds the shape of the history list while it loads. Rows rather than a
 * spinner, so the page does not jump when the real ones arrive.
 */
export default function AccountLoading() {
  return (
    <Container as="main" className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <Text as="h1" variant="displayMedium">
            Your orders
          </Text>
        </div>
        <div className="mt-8 rounded-lg border border-line bg-surface" aria-hidden="true">
          <div className="border-b border-line px-4 py-3">
            <Skeleton className="h-5 w-32" />
          </div>
          <ul className="divide-y divide-line">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <Skeleton className="hidden size-10 rounded-md sm:block" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-5 w-20" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
}
