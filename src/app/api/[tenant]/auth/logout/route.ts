import { NextResponse } from "next/server";

import { logoutBuyer } from "@/lib/erp";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";
import { clearSession, readSession } from "@/lib/session";

/**
 * Ends the session, at the ERP first and in the browser second.
 *
 * Order matters: clearing the cookie alone would leave a token that still
 * worked for anyone who had copied it. The ERP call is what actually revokes
 * it.
 *
 * Always 200, even with no session and even if the ERP call fails. There is
 * nothing a shopper can do about either, and a signing-out button that reports
 * an error while the cookie is gone is worse than one that quietly succeeds.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const { tenant } = await params;
  const session = await readSession(tenant);

  if (session) {
    try {
      await logoutBuyer(tenant, session);
    } catch (error) {
      // Worth knowing about — a session left live at the ERP is a real loose
      // end — but not worth telling the shopper, who has no way to act on it.
      console.error("storefront logout failed at the ERP", error);
    }
  }

  await clearSession(tenant);
  return NextResponse.json({ data: { success: true } });
}
