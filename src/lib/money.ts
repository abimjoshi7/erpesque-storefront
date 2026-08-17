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
