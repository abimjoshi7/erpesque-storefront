import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/cart-request";
import { shopperIp } from "@/lib/client-ip";
import { requestLoginCode } from "@/lib/erp";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";

/**
 * Asks the shop to send a one-time code to a phone number.
 *
 * The reply says nothing about whether that number has shopped here before.
 * Same body, same status, either way — a different answer for a known number
 * would turn this endpoint into a way of asking who the shop's customers are.
 * Nothing is created here either; the customer row is written when the code is
 * verified, so this cannot be used to fill the ERP with numbers.
 *
 * The ERP's refusals are relayed as they are written: a number that looks
 * wrong, a code sent moments ago, an hourly cap used up, or a shop with no SMS
 * provider at all. Each names something the shopper or the merchant can act on,
 * and the throttle is keyed on the number rather than the address because the
 * number is what an SMS bill is run up against.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const { tenant } = await params;

  let phone: string;
  let turnstileToken: string | undefined;
  try {
    const body = (await request.json()) as {
      phone?: unknown;
      turnstileToken?: unknown;
    };
    if (typeof body.phone !== "string" || !body.phone.trim()) {
      return NextResponse.json({ error: "Enter your phone number." }, { status: 400 });
    }
    phone = body.phone.trim();
    turnstileToken =
      typeof body.turnstileToken === "string" ? body.turnstileToken : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const challenge = await requestLoginCode(
      tenant,
      phone,
      turnstileToken,
      shopperIp(request),
    );
    if (!challenge) {
      return NextResponse.json({ error: "This shop is not available." }, { status: 404 });
    }
    return NextResponse.json({ data: challenge });
  } catch (error) {
    return authErrorResponse(error);
  }
}
