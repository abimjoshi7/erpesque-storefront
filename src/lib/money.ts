import type { Tenant } from "@/lib/erp";

type Currency = NonNullable<Tenant["currency"]>;

/**
 * Formats a price the ERP sent as integer minor units.
 *
 * The division happens once, here, purely to hand `Intl.NumberFormat` a number
 * to render. Nothing else in this project does arithmetic on money: cart
 * subtotals and totals come from the ERP's own quote endpoint, so there is no
 * second implementation of the tax and rounding rules to drift out of sync
 * with the one in Rust.
 */
export function formatPrice(minor: number | null | undefined, currency: Currency): string {
  if (minor === null || minor === undefined) return "Price on request";

  const decimals = currency.decimalPlaces ?? 2;
  const major = minor / 10 ** decimals;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major);

  // The symbol is prepended rather than passed as `style: "currency"` because
  // the tenant supplies its own symbol (`currencies.symbol`, e.g. "Rs") and
  // Intl would otherwise render its own idea of NPR.
  return `${currency.symbol ?? currency.code ?? ""} ${formatted}`.trim();
}

/**
 * The same amount as a plain decimal string, for machines rather than people.
 *
 * schema.org's `price` wants "560.00", not "Rs 560" — a formatted price there
 * is invalid structured data. Scale comes from the tenant's own
 * `decimalPlaces`, because a currency with none (or three) is not a rounding
 * error away from two.
 */
export function priceAsNumber(
  minor: number | null | undefined,
  currency: Currency,
): string | null {
  if (minor === null || minor === undefined) return null;
  const decimals = currency.decimalPlaces ?? 2;
  return (minor / 10 ** decimals).toFixed(decimals);
}

/**
 * A shopper-typed amount as integer minor units.
 *
 * The price filter is the one place a *person* states money to this app, and
 * they state it the way it is printed — "620", not 62000. Everything past this
 * function is minor units again, so the ERP is never handed a major figure and
 * no comparison is ever made across the two scales.
 *
 * `Math.round` after scaling, not before: "6.005" at two decimals is 601 minor,
 * and truncating would quietly move the shopper's bound by a paisa.
 */
export function majorToMinor(
  major: number,
  currency: Currency,
): number {
  const decimals = currency.decimalPlaces ?? 2;
  return Math.round(major * 10 ** decimals);
}

/**
 * Reads a price a shopper typed, or that arrived in a URL.
 *
 * Returns `undefined` for anything that is not a positive finite number, so a
 * hand-edited `?minPrice=abc` widens to the whole shop rather than narrowing to
 * nothing. Capped well above any plausible shelf price to keep an absurd bound
 * out of the query string and out of the canonical link.
 */
export function parseMajorAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1e12) return undefined;
  return parsed;
}
