import { StatusPill, type StatusTone } from "@/design-system";
import type { Product } from "@/lib/erp";

type Availability = NonNullable<Product["availability"]>;

/**
 * The three words the ERP will say about stock, and nothing more.
 *
 * The API returns a coarse enum rather than a quantity on purpose, so there is
 * no number here to render even if a design asked for one.
 */
const LABELS: Record<Availability, string> = {
  in_stock: "In stock",
  low_stock: "Only a few left",
  out_of_stock: "Out of stock",
};

/**
 * The same mapping `DSStatusPill.toneForStatus` gives `inStock` / `low` /
 * `out`, so a shopper looking at the storefront and a clerk looking at the ERP
 * see one item wearing one color.
 */
const TONES: Record<Availability, StatusTone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "critical",
};

/**
 * Renders nothing when the ERP returned no availability — the shop has named no
 * location, or the item is not stock-tracked. That is "we cannot say", which is
 * not the same as zero, and inventing a badge for it would be a promise this
 * app is in no position to make.
 */
export function AvailabilityBadge({
  availability,
}: {
  availability: Product["availability"];
}) {
  if (!availability) return null;

  return <StatusPill tone={TONES[availability]}>{LABELS[availability]}</StatusPill>;
}
