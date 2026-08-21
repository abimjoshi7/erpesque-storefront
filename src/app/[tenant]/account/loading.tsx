import { Skeleton, Text } from "@/design-system";

/**
 * Holds the shape of the history list while it loads. Rows rather than a
 * spinner, so the page does not jump when the real ones arrive.
 */
export default function AccountLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Text as="h1" variant="displayMedium">
        Your orders
      </Text>
      <ul className="mt-8 flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <li key={row}>
            <Skeleton className="h-[86px] w-full rounded-md" />
          </li>
        ))}
      </ul>
    </main>
  );
}
