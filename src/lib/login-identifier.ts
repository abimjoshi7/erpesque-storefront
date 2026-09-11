import type { LoginIdentifier } from "@/lib/erp";

/**
 * Reads the one identifier a sign-in request names — a phone number or an
 * email address — out of a request body, for both code routes.
 *
 * Shared so that the request and the redemption cannot disagree about what
 * "exactly one" means. The pass is shallow on purpose: it trims, and it refuses
 * a body that names both or neither, and that is all. Whether a number is a
 * number or an address an address is the ERP's call — it canonicalises both and
 * owns the rules — and a second opinion here could only contradict it.
 */
export function readIdentifier(
  body: { phone?: unknown; email?: unknown },
): { identifier: LoginIdentifier } | { error: string } {
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (phone && email) return { error: "Use either your phone number or your email, not both." };
  if (phone) return { identifier: { phone } };
  if (email) return { identifier: { email } };
  return { error: "Enter the email address or phone number to send the code to." };
}
