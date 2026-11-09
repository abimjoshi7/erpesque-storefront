import { describe, expect, it } from "vitest";

import { readIdentifier } from "@/lib/login-identifier";

describe("readIdentifier", () => {
  it("takes a phone number, trimmed", () => {
    expect(readIdentifier({ phone: " 9800000000 " })).toEqual({
      identifier: { phone: "9800000000" },
    });
  });

  it("refuses an email, which is not an identity", () => {
    expect(readIdentifier({ email: "buyer@example.com" })).toEqual({
      error: "Sign in with your phone number. Email is not accepted.",
    });
    expect(readIdentifier({ phone: "9800000000", email: "buyer@example.com" })).toEqual({
      error: "Sign in with your phone number. Email is not accepted.",
    });
  });

  it("refuses a missing phone, including blanks and non-strings", () => {
    const error = "Enter the phone number to send the code to.";
    expect(readIdentifier({})).toEqual({ error });
    expect(readIdentifier({ phone: "   " })).toEqual({ error });
    expect(readIdentifier({ phone: 9800000000 })).toEqual({ error });
  });

  it("does not judge the shape of the number — that is the ERP's call", () => {
    expect(readIdentifier({ phone: "not-a-number" })).toEqual({
      identifier: { phone: "not-a-number" },
    });
  });
});
