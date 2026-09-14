import { ButtonLink, Icon, Text } from "@/design-system";

/**
 * The 404 for anything outside a shop — an unknown tenant code above all.
 *
 * A tenant that does not exist, one that is suspended and one that has not
 * switched the storefront on all reach this same page, and the copy is careful
 * to say only "not here". Naming which of the three it was would let anyone
 * discover which tenant codes are real by reading the difference.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-subdued text-ink-subdued">
        <Icon name="store" className="size-7" />
      </span>
      <Text as="h1" variant="displayMedium" className="mt-6">
        Nothing here
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-3 text-balance">
        This address does not point at a shop. Check the link your shop gave
        you — a shop lives at its own address, and the last part of it is the
        shop&rsquo;s own code.
      </Text>
      <ButtonLink href="/" variant="secondary" className="mt-8">
        Back to the start
      </ButtonLink>
    </main>
  );
}
