import { describe, expect, it } from "vitest";

import { isFiltered, listingHref, readFilters, withFilters } from "@/lib/catalog-url";

describe("readFilters", () => {
  it("reads a whole listing URL", () => {
    expect(
      readFilters({
        q: " polish ",
        category: "shoe-care",
        brand: "kiwi",
        sort: "price_asc",
        minPrice: "100",
        maxPrice: "900",
        inStock: "true",
        page: "3",
      }),
    ).toEqual({
      q: "polish",
      category: "shoe-care",
      brand: "kiwi",
      sort: "price_asc",
      minPrice: 100,
      maxPrice: 900,
      inStock: true,
      page: 3,
    });
  });

  it("drops malformed values instead of rejecting the request", () => {
    expect(
      readFilters({
        q: "   ",
        sort: "cheapest",
        minPrice: "abc",
        maxPrice: "-1",
        inStock: "1",
        page: "0",
      }),
    ).toEqual({
      q: undefined,
      category: undefined,
      brand: undefined,
      sort: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: undefined,
      page: undefined,
    });
  });

  it("treats page 1 as no page, so one listing has one URL", () => {
    expect(readFilters({ page: "1" }).page).toBeUndefined();
  });
});

describe("listingHref", () => {
  it("leaves defaults out", () => {
    expect(listingHref("nsbs", {})).toBe("/nsbs");
    expect(listingHref("nsbs", { sort: "featured", page: 1 })).toBe("/nsbs");
  });

  it("carries everything that is not a default", () => {
    expect(
      listingHref("nsbs", {
        q: "polish",
        category: "shoe care",
        sort: "newest",
        minPrice: 100,
        inStock: true,
        page: 2,
      }),
    ).toBe("/nsbs?q=polish&category=shoe+care&sort=newest&minPrice=100&inStock=true&page=2");
  });

  it("encodes the tenant segment", () => {
    expect(listingHref("a b", {})).toBe("/a%20b");
  });

  it("round-trips through readFilters", () => {
    const filters = { q: "polish", brand: "kiwi", sort: "price_desc" as const, page: 4 };
    const href = listingHref("nsbs", filters);
    const params = Object.fromEntries(new URL(href, "http://x.invalid").searchParams);
    expect(readFilters(params)).toMatchObject(filters);
  });
});

describe("withFilters", () => {
  it("changes one thing and returns to page 1", () => {
    expect(withFilters({ q: "polish", category: "a", page: 5 }, { category: "b" })).toEqual({
      q: "polish",
      category: "b",
      page: undefined,
    });
  });

  it("clears a filter when handed undefined", () => {
    expect(withFilters({ category: "a" }, { category: undefined }).category).toBeUndefined();
  });
});

describe("isFiltered", () => {
  it("ignores sort and pagination, which do not narrow anything", () => {
    expect(isFiltered({ sort: "newest", page: 3 })).toBe(false);
    expect(isFiltered({ inStock: true })).toBe(true);
    expect(isFiltered({ minPrice: 10 })).toBe(true);
  });
});
