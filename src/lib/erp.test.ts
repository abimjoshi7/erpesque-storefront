import { describe, expect, it } from "vitest";

import { normalizeTenant } from "@/lib/erp";

const CURRENCY = { code: "INR", symbol: "₹", decimalPlaces: 2 };

describe("normalizeTenant", () => {
  it("leaves a tenant from a current ERP alone", () => {
    const tenant = {
      code: "nsbs",
      name: "nsbs",
      currency: CURRENCY,
      requireSignIn: true,
      signInWith: ["email" as const],
    };
    expect(normalizeTenant(tenant)).toEqual(tenant);
  });

  it("fills in what an ERP from before signed-in checkout does not send", () => {
    // Exactly what api.ghumtibags.com answers today: no requireSignIn, no
    // signInWith. The generated types say both are required, so only a cast
    // stands between this payload and `shop.signInWith.includes(...)`.
    const older = { code: "nsbs", name: "nsbs", currency: CURRENCY } as Parameters<
      typeof normalizeTenant
    >[0];

    const tenant = normalizeTenant(older);

    expect(tenant.requireSignIn).toBe(false);
    expect(tenant.signInWith).toEqual([]);
    // No channel means the sign-in page says so; it must not throw first.
    expect(() => tenant.signInWith.includes("email")).not.toThrow();
  });

  it("keeps a shop that requires sign-in but has no channel intact", () => {
    const tenant = normalizeTenant({
      code: "nsbs",
      name: "nsbs",
      currency: CURRENCY,
      requireSignIn: true,
      signInWith: [],
    });
    expect(tenant.requireSignIn).toBe(true);
    expect(tenant.signInWith).toEqual([]);
  });
});
