import { Text } from "@/design-system";

/**
 * The root has no shop of its own — every storefront lives under its tenant
 * code. Rather than redirect somewhere arbitrary, say so plainly.
 */
export default function RootPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-24">
      <Text as="h1" variant="displayMedium">
        Storefront
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3">
        Each shop lives at its own address. Follow the link your shop gave you.
      </Text>
    </main>
  );
}
