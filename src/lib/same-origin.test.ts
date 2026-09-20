import { describe, expect, it } from "vitest";

import { forbiddenResponse, isSameOrigin } from "@/lib/same-origin";

function post(headers: Record<string, string>): Request {
  return new Request("https://shop.ghumtibags.com/api/nsbs/order", {
    method: "POST",
    headers,
  });
}

describe("isSameOrigin", () => {
  it("accepts a request with no Origin, which is not a browser", () => {
    expect(isSameOrigin(post({}))).toBe(true);
  });

  it("accepts an Origin matching the forwarded host", () => {
    expect(
      isSameOrigin(
        post({
          origin: "https://shop.ghumtibags.com",
          "x-forwarded-host": "shop.ghumtibags.com",
          host: "internal.workers.dev",
        }),
      ),
    ).toBe(true);
  });

  it("prefers the forwarded host over Host", () => {
    expect(
      isSameOrigin(
        post({
          origin: "https://shop.ghumtibags.com",
          "x-forwarded-host": "other.example",
          host: "shop.ghumtibags.com",
        }),
      ),
    ).toBe(false);
  });

  it("rejects another origin, including a sibling subdomain", () => {
    expect(
      isSameOrigin(
        post({ origin: "https://evil.example", host: "shop.ghumtibags.com" }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(
        post({ origin: "https://api.ghumtibags.com", host: "shop.ghumtibags.com" }),
      ),
    ).toBe(false);
  });

  it("rejects an Origin that will not parse", () => {
    expect(
      isSameOrigin(post({ origin: "not a url", host: "shop.ghumtibags.com" })),
    ).toBe(false);
  });
});

describe("forbiddenResponse", () => {
  it("is a bare 403", async () => {
    const response = forbiddenResponse();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Request rejected." });
  });
});
