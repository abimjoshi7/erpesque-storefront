import { describe, expect, it } from "vitest";

import { authErrorResponse, errorResponse, normalizeLines } from "@/lib/cart-request";
import { ErpError } from "@/lib/erp";

describe("normalizeLines", () => {
  it("keeps well-formed lines", () => {
    expect(normalizeLines([{ slug: "boot-polish", quantity: 2 }])).toEqual([
      { slug: "boot-polish", quantity: 2 },
    ]);
  });

  it("discards everything else rather than failing the request", () => {
    expect(
      normalizeLines([
        { slug: "", quantity: 1 },
        { slug: "a", quantity: 0 },
        { slug: "a", quantity: 1.5 },
        { slug: "a", quantity: "2" },
        { slug: 7, quantity: 1 },
        null,
        "a",
      ]),
    ).toEqual([]);
  });

  it("is empty for anything that is not an array", () => {
    expect(normalizeLines(undefined)).toEqual([]);
    expect(normalizeLines({ slug: "a", quantity: 1 })).toEqual([]);
  });

  it("drops extra properties an attacker might hope are read", () => {
    expect(normalizeLines([{ slug: "a", quantity: 1, priceMinor: 1 }])).toEqual([
      { slug: "a", quantity: 1 },
    ]);
  });
});

describe("errorResponse", () => {
  it("relays the ERP's own 400, which names what to change", async () => {
    const response = errorResponse(new ErpError(400, "/storefront/nsbs/quote", "'boot-polish' is no longer available"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "'boot-polish' is no longer available",
    });
  });

  it("hides anything else behind a 502", async () => {
    const response = errorResponse(new ErpError(500, "/storefront/nsbs/quote", "connection pool exhausted"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong. Try again.",
    });
  });
});

describe("authErrorResponse", () => {
  it.each([400, 401, 403, 429, 503])("passes a %i through so the form can tell them apart", async (status) => {
    const response = authErrorResponse(new ErpError(status, "/storefront/nsbs/auth/verify", "that code has expired"));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: "that code has expired" });
  });

  it("flattens anything else", async () => {
    const response = authErrorResponse(new Error("boom"));
    expect(response.status).toBe(502);
  });
});
