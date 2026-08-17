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

const STYLES: Record<Availability, string> = {
  in_stock: "text-emerald-700 dark:text-emerald-400",
  low_stock: "text-amber-700 dark:text-amber-400",
  out_of_stock: "text-neutral-500 dark:text-neutral-400",
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

  return (
    <span className={`text-xs font-medium ${STYLES[availability]}`}>
      {LABELS[availability]}
    </span>
  );
}
