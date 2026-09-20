import { describe, expect, it } from "vitest";

import { formatPrice, majorToMinor, parseMajorAmount, priceAsNumber } from "@/lib/money";

const NPR = { code: "NPR", symbol: "Rs", decimalPlaces: 2 };
const JPY = { code: "JPY", symbol: "¥", decimalPlaces: 0 };

describe("formatPrice", () => {
  it("renders minor units with the tenant's symbol and scale", () => {
    expect(formatPrice(62000, NPR)).toBe("Rs 620.00");
    expect(formatPrice(1234567, NPR)).toBe("Rs 12,345.67");
    expect(formatPrice(1200, JPY)).toBe("¥ 1,200");
  });

  it("says so when there is no price rather than rendering zero", () => {
    expect(formatPrice(null, NPR)).toBe("Price on request");
    expect(formatPrice(undefined, NPR)).toBe("Price on request");
    expect(formatPrice(0, NPR)).toBe("Rs 0.00");
  });
});

describe("priceAsNumber", () => {
  it("is a plain decimal at the currency's scale, for structured data", () => {
    expect(priceAsNumber(62000, NPR)).toBe("620.00");
    expect(priceAsNumber(1200, JPY)).toBe("1200");
    expect(priceAsNumber(null, NPR)).toBeNull();
  });
});

describe("majorToMinor", () => {
  it("scales what a shopper typed, rounding rather than truncating", () => {
    expect(majorToMinor(620, NPR)).toBe(62000);
    // 6.005 * 100 is 600.4999... in binary floating point; truncating would
    // move the shopper's bound by a paisa.
    expect(majorToMinor(6.005, NPR)).toBe(601);
    expect(majorToMinor(1200, JPY)).toBe(1200);
  });
});

describe("parseMajorAmount", () => {
  it("reads a positive number, trimmed", () => {
    expect(parseMajorAmount(" 620 ")).toBe(620);
    expect(parseMajorAmount("6.5")).toBe(6.5);
  });

  it("drops anything that is not one, so a bad filter widens the shop", () => {
    for (const value of ["", "abc", "0", "-5", "1e13", "NaN", undefined]) {
      expect(parseMajorAmount(value)).toBeUndefined();
    }
  });
});
