import type { LoginIdentifier } from "@/lib/erp";

/**
 * Reads the phone number a sign-in request names, for both code routes.
 *
 * The pass is shallow on purpose: it trims, and it refuses a body that names
 * an email or no phone, and that is all. Whether the number is a number is
 * the ERP's call — it canonicalises and owns the rules — and a second opinion
 * here could only contradict it.
 */
export function readIdentifier(body: {
  phone?: unknown;
  email?: unknown;
}): { identifier: LoginIdentifier } | { error: string } {
  if (typeof body.email === "string" && body.email.trim()) {
    return { error: "Sign in with your phone number. Email is not accepted." };
  }
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (phone) return { identifier: { phone } };
  return { error: "Enter the phone number to send the code to." };
}
