import type { Metadata } from "next";

import { Text } from "@/design-system";

import { SignInForm } from "./sign-in-form";

/**
 * Signing in is personal and there is nothing here for a crawler to index — the
 * page is a form and nothing else — so it stays out of search results alongside
 * the order pages.
 */
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Text as="h1" variant="displayMedium">
        Sign in
      </Text>
      <Text variant="bodyLarge" tone="subdued" className="mt-2">
        We will send a code to your phone. There is no password to remember.
      </Text>

      <SignInForm tenant={tenant} />

      <Text variant="caption" tone="muted" className="mt-8">
        Ordered before as a guest? Sign in with the same number and your past
        orders will be here.
      </Text>
    </main>
  );
}
