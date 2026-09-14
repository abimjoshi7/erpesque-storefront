"use client";

import { Button, Container, Icon, Text } from "@/design-system";

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
    <Container as="main" className="flex flex-col items-center py-20 text-center sm:py-28">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Icon name="alert" className="size-7" />
      </span>
      <Text as="h1" variant="displayMedium" className="mt-6 text-balance">
        The shop is not answering
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3 max-w-md text-pretty">
        Something went wrong at our end, not yours. Nothing has been ordered and
        your cart is untouched.
      </Text>
      <Button className="mt-8" onClick={() => retry()}>
        Try again
      </Button>
      {error.digest ? (
        // Only useful if the shopper reports it, and it is the one string that
        // ties their complaint to a line in the server log.
        <Text variant="caption" tone="disabled" className="mt-8 font-mono">
          Reference {error.digest}
        </Text>
      ) : null}
    </Container>
  );
}
