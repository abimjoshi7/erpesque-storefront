import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/cart-request";
import { shopperIp } from "@/lib/client-ip";
import { cancelOrder } from "@/lib/erp";

/**
 * Self-cancel, from the shopper's status page.
 *
 * The same seam as the quote and order handlers: the button is in the browser,
 * the ERP call happens here, and the API key never leaves the server.
 *
 * The token in the path is the whole authorisation — there is no session to
 * check and nothing here to check it against. Whether it is still cancellable
 * is the ERP's decision, not this handler's, so nothing is validated here that
 * would only be a second, staler opinion.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string; token: string }> },
) {
  const { tenant, token } = await params;

  try {
    const order = await cancelOrder(tenant, token, shopperIp(request));
    if (!order) {
      return NextResponse.json({ error: "This order could not be found." }, { status: 404 });
    }
    return NextResponse.json({ data: order });
  } catch (error) {
    return errorResponse(error);
  }
}
