import { describe, expect, it } from "vitest";

import { shopperIp } from "@/lib/client-ip";

function request(headers: Record<string, string>): Request {
  return new Request("https://shop.ghumtibags.com/api/nsbs/order", { headers });
}

describe("shopperIp", () => {
  it("prefers what Cloudflare set", () => {
    expect(
      shopperIp(
        request({ "cf-connecting-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.9" }),
      ),
    ).toBe("203.0.113.5");
  });

  it("falls back to the first entry of the proxy chain", () => {
    expect(shopperIp(request({ "x-forwarded-for": "203.0.113.5, 198.51.100.9" }))).toBe(
      "203.0.113.5",
    );
  });

  it("is undefined when nothing attributable arrived", () => {
    expect(shopperIp(request({}))).toBeUndefined();
    expect(shopperIp(request({ "cf-connecting-ip": "  ", "x-forwarded-for": " , x" }))).toBeUndefined();
  });
});
