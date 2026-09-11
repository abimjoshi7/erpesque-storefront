import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/cart-request";
import { shopperIp } from "@/lib/client-ip";
import { requestLoginCode, type LoginIdentifier } from "@/lib/erp";
import { readIdentifier } from "@/lib/login-identifier";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";

/**
 * Asks the shop to send a one-time code to a phone number or an email address —
 * exactly one, relayed as typed.
 *
 * The reply says nothing about whether that number or address has shopped here
 * before. Same body, same status, either way — a different answer for a known
 * one would turn this endpoint into a way of asking who the shop's customers
 * are. Nothing is created here either; the customer row is written when the
 * code is verified, so this cannot be used to fill the ERP with addresses.
 *
 * The ERP's refusals are relayed as they are written: an identifier that looks
 * wrong, a code sent moments ago, an hourly cap used up, or a channel the shop
 * cannot deliver on (a 503 — SMS, today). Each names something the shopper or
 * the merchant can act on, and the throttle is keyed on the identifier rather
 * than the caller's address because the identifier is what a message is sent
 * to, and what a bill is run up against.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const { tenant } = await params;

  let identifier: LoginIdentifier;
  let turnstileToken: string | undefined;
  try {
    const body = (await request.json()) as {
      phone?: unknown;
      email?: unknown;
      turnstileToken?: unknown;
    };
    const read = readIdentifier(body);
    if ("error" in read) {
      return NextResponse.json({ error: read.error }, { status: 400 });
    }
    identifier = read.identifier;
    turnstileToken =
      typeof body.turnstileToken === "string" ? body.turnstileToken : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const challenge = await requestLoginCode(
      tenant,
      identifier,
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
