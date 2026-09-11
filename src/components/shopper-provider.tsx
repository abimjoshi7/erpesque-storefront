"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type { ShopperSession } from "@/lib/erp";

/**
 * Who is signed in, asked once per page load and shared by everything in the
 * shop that needs to know.
 *
 * Two islands ask the same question: the header's account slot, and the add to
 * cart button on a shop that only takes signed-in orders. Each asking on its
 * own would be two calls to `/api/{tenant}/me` per product page — and each
 * call slides the ERP's session window and costs it a lookup — so the answer
 * lives here and both read it.
 *
 * Mounted by the shop layout, which stays a server component free of
 * request-time APIs. The session is resolved after hydration rather than by
 * reading the cookie in the layout, for the reason decision 0002 gives:
 * reading it there would make every page under `/{tenant}` render per request
 * to decide one link.
 *
 * The layout persists across client navigations, and so does this state. That
 * is the point — the header does not re-ask on every click — but it means a
 * sign-in or a sign-out has to say so, which is what `refresh` is for.
 */

type ShopperState = {
  /**
   * `undefined` while the first answer is in flight, `null` when nobody is
   * signed in. Kept apart so a caller can render nothing rather than a
   * "Sign in" that becomes a name a moment later.
   */
  session: ShopperSession | null | undefined;
  /** Ask again — after signing in or out, or after the ERP refused a session. */
  refresh: () => Promise<void>;
};

const ShopperContext = createContext<ShopperState | null>(null);

async function fetchMe(tenant: string): Promise<ShopperSession | null> {
  try {
    const response = await fetch(`/api/${tenant}/me`, { cache: "no-store" });
    const body = (await response.json()) as { data: ShopperSession | null };
    return body.data;
  } catch {
    // Not knowing is treated as not signed in. The worst case is a "Sign in"
    // link shown to someone who is, and the cart page checks for itself.
    return null;
  }
}

export function ShopperProvider({
  tenant,
  children,
}: {
  tenant: string;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<ShopperSession | null | undefined>(undefined);

  useEffect(() => {
    // The outside world — a cookie this component cannot read and a session
    // only the server can resolve — which is what an effect is for.
    let cancelled = false;
    void fetchMe(tenant).then((next) => {
      if (!cancelled) setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  const refresh = useCallback(async () => {
    setSession(await fetchMe(tenant));
  }, [tenant]);

  return (
    <ShopperContext value={{ session, refresh }}>{children}</ShopperContext>
  );
}

export function useShopper(): ShopperState {
  const state = useContext(ShopperContext);
  if (!state) {
    throw new Error("useShopper must be used inside the shop layout's ShopperProvider.");
  }
  return state;
}
