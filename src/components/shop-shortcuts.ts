import type { IconName } from "@/design-system";
import { listingHref } from "@/lib/catalog-url";

/** One fixed way into the catalog — a listing with a preset sort or filter. */
export type ShortcutLink = { label: string; href: string; icon: IconName };

/**
 * The ways into a shop that are not a shelf.
 *
 * Every one of these is the ordinary listing with a sort or a filter already
 * applied, so each lands on a real URL a shopper can share, and the sort menu
 * and filter panel on that page show exactly what the shortcut chose. Nothing
 * here is curated: "New arrivals" is the ERP's newest-first order and "Lowest
 * prices" is its price order, restricted to what can actually be bought today.
 *
 * Built on the server and handed to the header's client island as plain
 * strings, because `catalog-url` reaches into the server-only ERP module.
 */
export function shopShortcuts(tenant: string): ShortcutLink[] {
  return [
    { label: "New arrivals", href: listingHref(tenant, { sort: "newest" }), icon: "package" },
    {
      label: "Lowest prices",
      href: listingHref(tenant, { sort: "price_asc", inStock: true }),
      icon: "cash",
    },
    { label: "In stock", href: listingHref(tenant, { inStock: true }), icon: "check" },
  ];
}
