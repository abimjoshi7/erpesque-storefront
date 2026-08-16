"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { CartLine } from "@/lib/erp";

/**
 * The cart, in localStorage, holding slugs and quantities and nothing else.
 *
 * No prices are stored. That is not an oversight — a cart that remembers what
 * something cost is a cart that can be edited in devtools, and one that quietly
 * charges yesterday's price when the shop repriced overnight. Every screen that
 * shows money asks the server for a fresh quote, so a stale cart corrects
 * itself and there is nothing here worth tampering with.
 *
 * Keyed per tenant so two shops open in the same browser cannot pour their
 * carts into each other.
 *
 * Read through `useSyncExternalStore` rather than an effect: localStorage is
 * exactly the external mutable source that hook exists for, it gives a defined
 * server snapshot instead of a hydration mismatch, and it keeps every mounted
 * component on the same value without a bespoke subscription dance.
 */
const KEY_PREFIX = "erpesque.cart.";

/** Broadcast so a cart badge in one component follows edits made in another. */
const CHANGED = "erpesque:cart-changed";

/**
 * `useSyncExternalStore` compares snapshots by identity, so parsing on every
 * call would hand it a new array each time and spin. The parsed value is cached
 * against the raw string and only rebuilt when the raw string actually changes.
 */
const snapshots = new Map<string, { raw: string; lines: CartLine[] }>();

const EMPTY: CartLine[] = [];

function storageKey(tenant: string): string {
  return `${KEY_PREFIX}${tenant}`;
}

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    // Anything can end up in localStorage — another tab, an old version of this
    // app, a curious user. Validate rather than trust, and drop what does not
    // fit instead of rendering a broken cart.
    const lines = parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const { slug, quantity } = entry as Partial<CartLine>;
      if (typeof slug !== "string" || !slug) return [];
      if (typeof quantity !== "number" || !Number.isInteger(quantity)) return [];
      if (quantity < 1 || quantity > 999) return [];
      return [{ slug, quantity }];
    });
    return lines.length === 0 ? EMPTY : lines;
  } catch {
    return EMPTY;
  }
}

function readSnapshot(tenant: string): CartLine[] {
  const raw = window.localStorage.getItem(storageKey(tenant));
  const cached = snapshots.get(tenant);
  if (cached && cached.raw === (raw ?? "")) return cached.lines;
  const lines = parse(raw);
  snapshots.set(tenant, { raw: raw ?? "", lines });
  return lines;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  // `storage` fires only in *other* tabs, so both listeners are needed: one for
  // this tab's own edits, one for a second tab's.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(tenant: string, lines: CartLine[]): void {
  try {
    window.localStorage.setItem(storageKey(tenant), JSON.stringify(lines));
  } catch {
    // Private browsing and full quotas both throw here. Losing the cart is bad;
    // crashing the page the shopper is trying to buy from is worse.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function useCart(tenant: string) {
  const lines = useSyncExternalStore(
    subscribe,
    () => readSnapshot(tenant),
    // The server has no localStorage, so it renders an empty cart and the real
    // one appears on hydration. Returning anything else here would guarantee a
    // mismatch on every page load.
    () => EMPTY,
  );

  const add = useCallback(
    (slug: string, quantity = 1) => {
      const current = readSnapshot(tenant);
      const existing = current.find((line) => line.slug === slug);
      write(
        tenant,
        existing
          ? current.map((line) =>
              line.slug === slug
                ? { ...line, quantity: Math.min(line.quantity + quantity, 999) }
                : line,
            )
          : [...current, { slug, quantity }],
      );
    },
    [tenant],
  );

  const setQuantity = useCallback(
    (slug: string, quantity: number) => {
      const current = readSnapshot(tenant);
      write(
        tenant,
        quantity < 1
          ? current.filter((line) => line.slug !== slug)
          : current.map((line) =>
              line.slug === slug ? { ...line, quantity: Math.min(quantity, 999) } : line,
            ),
      );
    },
    [tenant],
  );

  const remove = useCallback((slug: string) => setQuantity(slug, 0), [setQuantity]);
  const clear = useCallback(() => write(tenant, []), [tenant]);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return { lines, count, add, setQuantity, remove, clear };
}
