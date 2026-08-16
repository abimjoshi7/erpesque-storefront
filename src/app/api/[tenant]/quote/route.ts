import { NextResponse } from "next/server";

import { errorResponse, normalizeLines } from "@/lib/cart-request";
import { fetchQuote, type CartLine } from "@/lib/erp";

/**
 * The cart page is interactive, so it runs in the browser — and the browser is
 * not allowed to hold the ERP API key. This handler is the seam: it takes the
 * cart from the client and makes the ERP call on the server.
 *
 * It forwards slugs and quantities and nothing else. Even if a caller posts
 * prices they are not read here, and there is no field for them on the way out,
 * so the server's figures are the only ones that ever exist.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;

  let lines: CartLine[];
  try {
    const body = (await request.json()) as { lines?: unknown };
    lines = normalizeLines(body.lines);
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  try {
    const quote = await fetchQuote(tenant, lines);
    if (!quote) {
      return NextResponse.json({ error: "This shop is not available." }, { status: 404 });
    }
    return NextResponse.json({ data: quote });
  } catch (error) {
    return errorResponse(error);
  }
}
