import { describe, expect, it } from "vitest";

import { readIdentifier } from "@/lib/login-identifier";

describe("readIdentifier", () => {
  it("takes whichever one is named, trimmed", () => {
    expect(readIdentifier({ phone: " 9800000000 " })).toEqual({
      identifier: { phone: "9800000000" },
    });
    expect(readIdentifier({ email: " buyer@example.com " })).toEqual({
      identifier: { email: "buyer@example.com" },
    });
  });

  it("refuses both at once", () => {
    expect(readIdentifier({ phone: "9800000000", email: "buyer@example.com" })).toEqual({
      error: "Use either your phone number or your email, not both.",
    });
  });

  it("refuses neither, including blanks and non-strings", () => {
    const error = "Enter the email address or phone number to send the code to.";
    expect(readIdentifier({})).toEqual({ error });
    expect(readIdentifier({ phone: "   ", email: "" })).toEqual({ error });
    expect(readIdentifier({ phone: 9800000000 })).toEqual({ error });
  });

  it("does not judge the shape of either — that is the ERP's call", () => {
    expect(readIdentifier({ email: "not-an-address" })).toEqual({
      identifier: { email: "not-an-address" },
    });
  });
});
