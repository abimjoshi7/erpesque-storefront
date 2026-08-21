import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/cart-request";
import { shopperIp } from "@/lib/client-ip";
import { verifyLoginCode } from "@/lib/erp";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";
import { setSession } from "@/lib/session";

/**
 * Exchanges a one-time code for a session.
 *
 * The only place in this app that writes the session cookie. Cookies cannot be
 * set while a server component renders — HTTP will not carry a `Set-Cookie`
 * once streaming has begun — so this handler is where it has to happen, and
 * keeping it to one place means the cookie's attributes are decided once, in
 * `lib/session`.
 *
 * The token the ERP returns here is its only copy; the ERP keeps a digest. It
 * goes straight into an httpOnly cookie and is never included in the response
 * body, so it does not reach any script on the page.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const { tenant } = await params;

  let challengeId: string;
  let code: string;
  let name: string | undefined;
  try {
    const body = (await request.json()) as {
      challengeId?: unknown;
      code?: unknown;
      name?: unknown;
    };
    if (typeof body.challengeId !== "string" || !body.challengeId) {
      return NextResponse.json({ error: "Start again from your phone number." }, { status: 400 });
    }
    if (typeof body.code !== "string" || !body.code.trim()) {
      return NextResponse.json({ error: "Enter the code you were sent." }, { status: 400 });
    }
    challengeId = body.challengeId;
    code = body.code.trim();
    name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const result = await verifyLoginCode(
      tenant,
      { challengeId, code, name },
      shopperIp(request),
    );
    if (!result) {
      return NextResponse.json({ error: "This shop is not available." }, { status: 404 });
    }

    await setSession(tenant, result.sessionToken);

    // Everything except the token. The page needs to know who signed in; the
    // browser has no use for the credential and every reason not to hold it.
    return NextResponse.json({
      data: { buyer: result.buyer, account: result.account, expiresAt: result.expiresAt },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
