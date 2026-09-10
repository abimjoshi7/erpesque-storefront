import { NextResponse } from "next/server";

import { ErpError, type CartLine } from "@/lib/erp";

/**
 * Shapes whatever arrived into cart lines, discarding the rest.
 *
 * The ERP validates all of this again — this pass exists only so an obvious
 * mistake becomes a clear message without a round trip. It is not a security
 * boundary and must never be treated as one.
 */
export function normalizeLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { slug, quantity } = entry as Partial<CartLine>;
    if (typeof slug !== "string" || !slug) return [];
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return [];
    return [{ slug, quantity }];
  });
}

/**
 * Relays the ERP's own explanation for a rejected cart ("'boot-polish' is no
 * longer available"), because it names the thing the shopper has to change.
 *
 * Anything else becomes a generic message: an internal failure should not
 * describe the ERP's internals to the public, and the detail belongs in the
 * server log where it is useful.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ErpError && error.status === 400) {
    return NextResponse.json(
      { error: error.detail ?? "That cart is not valid." },
      { status: 400 },
    );
  }
  console.error("storefront request failed", error);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 502 });
}

/**
 * Relays the ERP's own message for a rejection the shopper can act on.
 *
 * Sign-in fails in ways `errorResponse` above would flatten into "something
 * went wrong", and each of them tells the shopper what to do next: a 401 says
 * the code was wrong or expired, a 400 says the number looks wrong or that one
 * was just sent, a 503 says this shop cannot send codes at all. The statuses
 * are passed through unchanged so the form can distinguish them, and anything
 * outside the set falls back to the generic answer — an internal failure should
 * not describe the ERP's internals to the public.
 */
const RELAYED_STATUSES = new Set([400, 401, 403, 429, 503]);

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof ErpError && RELAYED_STATUSES.has(error.status)) {
    return NextResponse.json(
      { error: error.detail ?? "That did not work. Please try again." },
      { status: error.status },
    );
  }
  console.error("storefront sign-in request failed", error);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 502 });
}
