import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/cart-request";
import { deliverSandboxWhatsApp } from "@/lib/erp";
import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";

/**
 * Relays the sandbox stand-in for a WhatsApp reply. The ERP refuses this
 * unless `WHATSAPP_SANDBOX` is set, and the reply is the message WhatsApp
 * would have sent, including the code.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  let from: string;
  let text: string;
  try {
    const body = (await request.json()) as { phone?: unknown; text?: unknown };
    from = typeof body.phone === "string" ? body.phone.trim() : "";
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!from || !text) {
    return NextResponse.json({ error: "Phone and message are both needed." }, { status: 400 });
  }

  try {
    const delivered = await deliverSandboxWhatsApp(from, text);
    if (!delivered) {
      return NextResponse.json({ error: "WhatsApp sandbox is off." }, { status: 404 });
    }
    return NextResponse.json({ data: delivered });
  } catch (error) {
    return authErrorResponse(error);
  }
}
