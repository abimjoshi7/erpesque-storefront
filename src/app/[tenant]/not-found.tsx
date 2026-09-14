"use client";

import { useParams } from "next/navigation";

import { ButtonLink, Container, Icon, Text } from "@/design-system";

/**
 * A missing page inside a shop that is open — nearly always a product that has
 * been unpublished, sold out of the catalog, or renamed.
 *
 * Rendered inside the shop layout, so the header above it still carries the
 * shop's name, its search box and the shopper's cart. That matters more than
 * the wording: a 404 that keeps the shop around it is a wrong turn, and one
 * that drops the shopper onto a bare page is the end of the visit.
 *
 * A client component only for `useParams`: a not-found page is given no props,
 * and the way back to the shelves needs to know whose shelves they are.
 */
export default function ShopNotFound() {
  const { tenant } = useParams<{ tenant: string }>();

  return (
    <Container as="main" className="flex flex-col items-center py-20 text-center sm:py-28">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-subdued text-ink-subdued">
        <Icon name="package" className="size-7" />
      </span>
      <Text as="h1" variant="displayMedium" className="mt-6 text-balance">
        That product is not in the shop
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3 max-w-md text-pretty">
        It may have sold out or been taken down. Search above, or browse
        everything the shop has on its shelves now.
      </Text>
      <ButtonLink href={`/${tenant}`} className="mt-8">
        Browse all products
        <Icon name="arrow-right" className="size-4" />
      </ButtonLink>
    </Container>
  );
}
