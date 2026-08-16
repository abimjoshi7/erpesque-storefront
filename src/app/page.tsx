/**
 * The root has no shop of its own — every storefront lives under its tenant
 * code. Rather than redirect somewhere arbitrary, say so plainly.
 */
export default function RootPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Storefront</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Each shop lives at its own address. Follow the link your shop gave you.
      </p>
    </main>
  );
}
