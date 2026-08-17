"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Cancels the order this page is showing.
 *
 * Behind a confirmation because it cannot be undone from here — re-ordering is
 * possible, un-cancelling is not.
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
    <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      {error ? (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Cancel this order? This cannot be undone.</p>
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {submitting ? "Cancelling…" : "Yes, cancel it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={submitting}
            className="text-sm underline underline-offset-4"
          >
            Keep the order
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-400"
        >
          Cancel this order
        </button>
      )}
    </div>
  );
}
