"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Button } from "@/design-system";

/**
 * Ends the session. The handler revokes it at the ERP before clearing the
 * cookie, so this is not merely a local forget.
 *
 * The shop's shared shopper state outlives navigation, so it is told as well;
 * otherwise the header would keep greeting a shopper who has just left.
 */
export function SignOut({ tenant }: { tenant: string }) {
  const router = useRouter();
  const { refresh } = useShopper();
  const [submitting, setSubmitting] = useState(false);

  async function signOut() {
    setSubmitting(true);
    try {
      await fetch(`/api/${tenant}/auth/logout`, { method: "POST" });
    } catch {
      // The handler always succeeds and the cookie is gone either way; there is
      // nothing here for the shopper to do about a failed call.
    } finally {
      await refresh();
      router.push(`/${tenant}`);
      router.refresh();
    }
  }

  return (
    <Button variant="tertiary" size="sm" onClick={signOut} loading={submitting}>
      {submitting ? "Signing out…" : "Sign out"}
    </Button>
  );
}
