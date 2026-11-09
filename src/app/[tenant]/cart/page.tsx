import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { checkoutHref } from "@/lib/next-path";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

type PageProps = { params: Promise<{ tenant: string }> };

/**
 * Checkout lives on the shop, in the payment rail.
 *
 * This route stays so a bookmark, a footer link, or a sign-in return that
 * still says `/cart` lands on that rail instead of a second screen.
 */
export default async function CartPage({ params }: PageProps) {
  const { tenant } = await params;
  redirect(checkoutHref(tenant));
}
