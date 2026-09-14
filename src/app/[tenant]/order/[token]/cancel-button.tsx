"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Notice, Text } from "@/design-system";

/**
 * Cancels the order this page is showing.
 *
 * Behind a confirmation because it cannot be undone from here — re-ordering is
 * possible, un-cancelling is not. Only the confirming button wears the
 * destructive red; the first one merely asks, and a red button that only asks
 * teaches a shopper that red does not mean it.
 *
 * The ERP re-checks server-side that the order is still cancellable, so a page
 * left open while the shop confirmed the order gets an honest refusal rather
 * than cancelling something already being packed. That refusal is shown as it
 * arrives; it is written for the shopper.
 */
export function CancelOrder({ tenant, token }: { tenant: string; token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/${tenant}/order/${encodeURIComponent(token)}/cancel`,
        { method: "POST" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not cancel this order.");
        return;
      }
      // Re-read from the server rather than patching state here: the status
      // line, the totals and this button all move together, and the server is
      // the only thing that knows what they should say.
      router.refresh();
    } catch {
      setError("Could not reach the shop. Check your connection.");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  return (
    <Card
      header={
        <Text as="h2" variant="headlineMedium">
          Changed your mind?
        </Text>
      }
    >
      {error ? (
        <Notice tone="critical" className="mb-4">
          {error}
        </Notice>
      ) : null}

      {confirming ? (
        <div className="flex flex-col gap-3">
          <Text variant="bodySmall" tone="strong" className="font-semibold">
            Cancel this order? This cannot be undone.
          </Text>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={cancel}
              loading={submitting}
            >
              {submitting ? "Cancelling…" : "Yes, cancel it"}
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              Keep the order
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <Text variant="bodySmall" tone="subdued">
            You can cancel this order until the shop starts on it.
          </Text>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Cancel this order
          </Button>
        </div>
      )}
    </Card>
  );
}
