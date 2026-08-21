import { NextResponse } from "next/server";

import { shopperIp } from "@/lib/client-ip";
import { errorResponse, normalizeLines } from "@/lib/cart-request";
import { placeOrder, type CartLine, type Contact } from "@/lib/erp";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";

/**
 * Submits the order. Same seam as the quote handler: the checkout form runs in
 * the browser, the ERP call happens here.
 *
 * The total the shopper saw is not sent and could not be honoured if it were —
 * the ERP reprices the cart from the catalog as it writes the order, so what is
 * ordered is always what the shop currently sells, at the price it currently
 * charges.
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

  try {
    const order = await placeOrder(
      tenant,
      { lines, contact, note, turnstileToken },
      shopperIp(request),
    );
    if (!order) {
      return NextResponse.json({ error: "This shop is not available." }, { status: 404 });
    }
    return NextResponse.json({ data: order });
  } catch (error) {
    return errorResponse(error);
  }
}
