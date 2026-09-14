import { Icon, Text } from "@/design-system";

/**
 * The root has no shop of its own — every storefront lives under its tenant
 * code. Rather than redirect somewhere arbitrary, say so plainly.
 */
export default function RootPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-subdued text-ink-subdued">
        <Icon name="store" className="size-7" />
      </span>
      <Text as="h1" variant="displayMedium" className="mt-6">
        Storefront
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3 text-balance">
        Each shop lives at its own address. Follow the link your shop gave you.
      </Text>
    </main>
  );
}
