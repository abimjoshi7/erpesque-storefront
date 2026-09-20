import { describe, expect, it } from "vitest";

import { safeNext, signInHref } from "@/lib/next-path";

const TENANT = "nsbs";
const FALLBACK = "/nsbs/account";

describe("safeNext", () => {
  it("keeps a path on this shop, query and fragment included", () => {
    expect(safeNext(TENANT, "/nsbs/cart")).toBe("/nsbs/cart");
    expect(safeNext(TENANT, "/nsbs")).toBe("/nsbs");
    expect(safeNext(TENANT, "/nsbs/product/boot-polish?size=2#stock")).toBe(
      "/nsbs/product/boot-polish?size=2#stock",
    );
  });

  it.each([
    ["an absolute URL elsewhere", "https://evil.example/nsbs"],
    ["a protocol-relative URL", "//evil.example/nsbs"],
    ["a backslash host", "/\\evil.example/nsbs"],
    ["another tenant", "/other/account"],
    ["a tenant that only shares the prefix", "/nsbsx/account"],
    ["a bare path outside the tenant", "/admin"],
    ["a relative path", "nsbs/cart"],
    ["an embedded control character", "/nsbs/ca\u0000rt"],
    ["an encoded slash", "/nsbs/%2fevil.example"],
    ["an empty value", ""],
    ["a non-string", 42],
    ["something over the length cap", `/nsbs/${"a".repeat(600)}`],
  ])("refuses %s", (_case, value) => {
    expect(safeNext(TENANT, value)).toBe(FALLBACK);
  });

  it("normalises traversal before checking the prefix", () => {
    expect(safeNext(TENANT, "/nsbs/../other/account")).toBe(FALLBACK);
    expect(safeNext(TENANT, "/nsbs/%2e%2e/other")).toBe(FALLBACK);
    expect(safeNext(TENANT, "/nsbs/cart/../account")).toBe("/nsbs/account");
  });

  it("refuses the sign-in page itself, which would loop", () => {
    expect(safeNext(TENANT, "/nsbs/sign-in")).toBe(FALLBACK);
    expect(safeNext(TENANT, "/nsbs/sign-in/verify")).toBe(FALLBACK);
  });
});

describe("signInHref", () => {
  it("encodes the path it comes back to", () => {
    expect(signInHref(TENANT, "/nsbs/cart?ref=a b")).toBe(
      "/nsbs/sign-in?next=%2Fnsbs%2Fcart%3Fref%3Da%20b",
    );
  });
});
