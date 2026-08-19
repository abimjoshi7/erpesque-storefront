"use client";

import Link from "next/link";

import { useCart } from "@/lib/cart";

/**
 * Cart link with a count.
 *
 * The count is empty until after mount because the cart lives in localStorage,
 * which the server cannot see — rendering a number during SSR would guarantee a
 * hydration mismatch on every page load.
 */
export function CartLink({ tenant }: { tenant: string }) {
  const { count } = useCart(tenant);

  return (
    <Link
      href={`/${tenant}/cart`}
      className="text-body font-medium text-ink underline underline-offset-4 transition-colors duration-(--duration-fast) ease-standard hover:text-ink-strong"
    >
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
