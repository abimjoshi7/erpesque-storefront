import Link from "next/link";

import { Text } from "@/design-system";

/**
 * The 404 for anything outside a shop — an unknown tenant code above all.
 *
 * A tenant that does not exist, one that is suspended and one that has not
 * switched the storefront on all reach this same page, and the copy is careful
 * to say only "not here". Naming which of the three it was would let anyone
 * discover which tenant codes are real by reading the difference.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-24">
      <Text as="h1" variant="displayMedium">
        Nothing here
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3">
        This address does not point at a shop. Check the link your shop gave
        you — a shop lives at its own address, and the last part of it is the
        shop&rsquo;s own code.
      </Text>
      <p className="mt-6">
        <Link
          href="/"
          className="text-body font-medium text-ink underline underline-offset-4"
        >
          Back to the start
        </Link>
      </p>
    </main>
  );
}
