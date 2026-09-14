"use client";

import { Button, Icon, Text } from "@/design-system";

/**
 * The failure a shop's own error page cannot catch.
 *
 * `error.tsx` wraps its segment's page and everything nested below it, but not
 * the layout beside it — so when `[tenant]/layout.tsx` cannot reach the ERP to
 * find out whether the shop is open, `[tenant]/error.tsx` never gets a chance
 * to render. That is the single most likely way this app fails, and without
 * this file it would fall all the way through to `global-error`, which throws
 * the stylesheet away with it.
 *
 * The copy avoids naming the shop for the same reason it avoids naming the
 * fault: at this point nothing has been read, so there is no shop name to use
 * and no way to tell a closed shop from an unreachable one.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-critical-soft text-critical">
        <Icon name="alert" className="size-7" />
      </span>
      <Text as="h1" variant="displayMedium" className="mt-6">
        This page would not load
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3 text-balance">
        Something went wrong at our end, not yours. Nothing has been ordered and
        your cart is untouched.
      </Text>
      <Button className="mt-8" onClick={() => retry()}>
        Try again
      </Button>
      {error.digest ? (
        <Text variant="caption" tone="disabled" className="mt-6">
          Reference {error.digest}
        </Text>
      ) : null}
    </main>
  );
}
