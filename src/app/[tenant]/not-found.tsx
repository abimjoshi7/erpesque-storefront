import { Text } from "@/design-system";

/**
 * A missing page inside a shop that is open — nearly always a product that has
 * been unpublished, sold out of the catalog, or renamed.
 *
 * Rendered inside the shop layout, so the header above it still carries the
 * shop's name, its search box and the shopper's cart. That matters more than
 * the wording: a 404 that keeps the shop around it is a wrong turn, and one
 * that drops the shopper onto a bare page is the end of the visit.
 */
export default function ShopNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <Text as="h1" variant="displayMedium">
        That product is not in the shop
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3">
        It may have sold out or been taken down. Search above, or browse the
        shop from the name at the top of the page.
      </Text>
    </main>
  );
}
