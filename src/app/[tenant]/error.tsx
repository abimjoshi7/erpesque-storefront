"use client";

import { Button, Text } from "@/design-system";

/**
 * What a shopper sees when the ERP is unreachable or answers with something
 * other than a 404.
 *
 * The distinction matters and is deliberate: a shop that is closed 404s and
 * gets the not-found page, while a shop that exists but cannot be read right
 * now lands here. Telling a shopper "this shop does not exist" because a
 * database was restarting would cost the merchant the visit.
 *
 * `retry` — not `reset` — is what re-runs the server render. `reset` only
 * re-renders what is already in the client, which for a failure that happened
 * while fetching means failing again instantly.
 *
 * No detail from `error` is shown. In production its message is already a
 * generic string with a digest, and the digest belongs in the server log, not
 * on a page a shopper is trying to buy from.
 */
export default function ShopError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <Text as="h1" variant="displayMedium">
        The shop is not answering
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3">
        Something went wrong at our end, not yours. Nothing has been ordered and
        your cart is untouched.
      </Text>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
      {error.digest ? (
        // Only useful if the shopper reports it, and it is the one string that
        // ties their complaint to a line in the server log.
        <Text variant="caption" tone="disabled" className="mt-6">
          Reference {error.digest}
        </Text>
      ) : null}
    </main>
  );
}
