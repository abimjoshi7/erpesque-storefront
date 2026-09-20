import { describe, expect, it } from "vitest";

import { STATUS_COPY, formatOrderDate, statusCopy } from "@/lib/order-status";

describe("statusCopy", () => {
  it("describes each ERP status", () => {
    expect(statusCopy("delivered")).toEqual(STATUS_COPY.delivered);
    expect(statusCopy("cancelled").tone).toBe("critical");
  });

  it("falls back to pending for anything unknown or missing", () => {
    expect(statusCopy("invented_status")).toEqual(STATUS_COPY.pending);
    expect(statusCopy(undefined)).toEqual(STATUS_COPY.pending);
    expect(statusCopy(null)).toEqual(STATUS_COPY.pending);
  });

  it("is not reachable through prototype keys", () => {
    expect(statusCopy("toString")).toEqual(STATUS_COPY.pending);
  });
});

describe("formatOrderDate", () => {
  it("is the same long form whoever renders it", () => {
    expect(formatOrderDate("2026-08-19T18:30:00Z")).toBe("19 August 2026");
  });

  it("reads the timestamp in UTC, not the runner's zone", () => {
    expect(formatOrderDate("2026-08-19T23:30:00Z")).toBe("19 August 2026");
  });

  it("is empty for a date that is not one", () => {
    expect(formatOrderDate("not a date")).toBe("");
  });
});
