"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Me } from "@/lib/erp";

/**
 * "Sign in", or the buyer's name once they are.
 *
 * A client component that asks after hydration, rather than a server component
 * reading the cookie. Reading a cookie in the shop layout is a request-time
 * API, and it would opt every page beneath `/{tenant}` into per-request
 * rendering — the whole catalog made dynamic to render one link. Decision 0002
 * spells this out; the cheap version is that the link is not worth the shop's
 * caching.
 *
 * Rendering nothing until the answer arrives, rather than a "Sign in" that
 * might immediately become a name, keeps the header from flickering between two
 * different words on every navigation.
 */
export function AccountLink({ tenant }: { tenant: string }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    // The outside world — a cookie this component cannot read and a session
    // only the server can resolve — which is what an effect is for.
    let cancelled = false;
    fetch(`/api/${tenant}/me`)
      .then((response) => response.json() as Promise<{ data: Me | null }>)
      .then((body) => {
        if (!cancelled) setMe(body.data);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  if (me === undefined) return null;

  return me ? (
    <Link
      href={`/${tenant}/account`}
      className="text-body-sm font-semibold text-ink hover:text-ink-strong"
    >
      {me.buyer.name ?? "Your orders"}
    </Link>
  ) : (
    <Link
      href={`/${tenant}/sign-in`}
      className="text-body-sm font-semibold text-ink hover:text-ink-strong"
    >
      Sign in
    </Link>
  );
}
