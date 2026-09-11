import { NextResponse } from "next/server";

import { shopperIp } from "@/lib/client-ip";
import { errorResponse, normalizeLines } from "@/lib/cart-request";
import { ErpError, placeOrder, type CartLine, type Contact } from "@/lib/erp";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";
import { clearSession, readSession } from "@/lib/session";

/**
 * The two ways a signed-in-only shop turns an order away. Both send the
 * checkout to the sign-in page; they differ only in whether the shopper was
 * signed in a moment ago.
 */
const SIGN_IN_FIRST = "Sign in to place your order.";
const SIGN_IN_AGAIN = "Your session ended — sign in again to place your order.";

/**
 * Submits the order. Same seam as the quote handler: the checkout form runs in
 * the browser, the ERP call happens here.
 *
 * The total the shopper saw is not sent and could not be honoured if it were —
 * the ERP reprices the cart from the catalog as it writes the order, so what is
 * ordered is always what the shop currently sells, at the price it currently
 * charges.
 *
 * The shopper's session, when there is one, is forwarded as `X-Shopper-Session`
 * and never looked at here. The ERP decides what it means: it bills the order
 * to the buyer's account, and where the shopper signed in by phone it records
 * that verified number in place of whatever was typed (an email sign-in keeps
 * the typed number, as one for the rider to ring). On a shop that requires
 * sign-in, the ERP refuses an order without a live session with a 401, and
 * that 401 is the only place the rule is decided.
 *
 * This handler used to refuse first when there was no cookie, reading the
 * shop's `requireSignIn` to spare the ERP a round trip. That read was the
 * layout's hour-cached tenant, so a merchant who turned sign-in off kept having
 * guest orders refused here for up to an hour while the ERP would have taken
 * them. A second copy of a rule is a copy that can be stale; the round trip is
 * cheaper than the lost orders.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const { tenant } = await params;

  let lines: CartLine[];
  let contact: Contact;
  let note: string | undefined;
  let turnstileToken: string | undefined;

  try {
    const body = (await request.json()) as {
      lines?: unknown;
      contact?: Partial<Contact>;
      note?: unknown;
      turnstileToken?: unknown;
    };
    lines = normalizeLines(body.lines);
    contact = {
      name: String(body.contact?.name ?? "").trim(),
      phone: String(body.contact?.phone ?? "").trim(),
      address: String(body.contact?.address ?? "").trim(),
      landmark: body.contact?.landmark ? String(body.contact.landmark).trim() : undefined,
    };
    note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    // Passed through unread. Only the ERP can judge it, and a check here would
    // be a second opinion with no authority — the secret key lives there.
    turnstileToken =
      typeof body.turnstileToken === "string" && body.turnstileToken
        ? body.turnstileToken
        : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (!contact.name || !contact.phone || !contact.address) {
    return NextResponse.json(
      { error: "Name, phone and address are all needed for delivery." },
      { status: 400 },
    );
  }

  const session = await readSession(tenant);

  try {
    const order = await placeOrder(
      tenant,
      { lines, contact, note, turnstileToken },
      { session, shopperIp: shopperIp(request) },
    );
    if (!order) {
      return NextResponse.json({ error: "This shop is not available." }, { status: 404 });
    }
    return NextResponse.json({ data: order });
  } catch (error) {
    if (error instanceof ErpError && error.status === 401) {
      // The ERP only answers 401 on a shop that requires sign-in — elsewhere a
      // lapsed session places a guest order. With a cookie sent, that cookie is
      // worthless now, and dropping it spares the next page a lookup that would
      // fail. Without one there is nothing to drop.
      if (session) await clearSession(tenant);
      return NextResponse.json(
        { error: session ? SIGN_IN_AGAIN : SIGN_IN_FIRST },
        { status: 401 },
      );
    }
    if (error instanceof ErpError && RELAYED.has(error.status) && error.detail) {
      return NextResponse.json({ error: error.detail }, { status: error.status });
    }
    return errorResponse(error);
  }
}

/**
 * Refusals the shopper can act on, relayed in the ERP's own words: Turnstile
 * not satisfied (403), too many orders from this address (429), and a shop
 * whose bot check is required but not configured (503). Everything else goes
 * through `errorResponse`, which keeps the ERP's internals out of public view.
 */
const RELAYED = new Set([403, 429, 503]);
