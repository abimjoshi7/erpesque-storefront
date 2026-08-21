import { NextResponse } from "next/server";

import { fetchMe, isUnauthorized } from "@/lib/erp";
import { clearSession, readSession } from "@/lib/session";

/**
 * Who is signed in, for the account slot in the shop header.
 *
 * This exists so the header can be a client island. Reading the cookie in the
 * shop layout instead would opt every page beneath `/{tenant}` into per-request
 * rendering, which is a heavy price for a "Sign in" link — see decision 0002.
 *
 * `null` rather than a 401 for a signed-out shopper: not being signed in is the
 * ordinary case for this endpoint, and a console full of 401s on every catalog
 * page would bury the ones that mean something.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const session = await readSession(tenant);

  if (!session) return NextResponse.json({ data: null });

  try {
    const me = await fetchMe(tenant, session);
    return NextResponse.json({ data: me ?? null });
  } catch (error) {
    if (isUnauthorized(error)) {
      // The session expired or was revoked. Drop the cookie so the browser
      // stops sending a token that will never work again.
      await clearSession(tenant);
      return NextResponse.json({ data: null });
    }
    console.error("storefront session lookup failed", error);
    return NextResponse.json({ data: null });
  }
}
