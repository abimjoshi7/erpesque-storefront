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
      className="text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
