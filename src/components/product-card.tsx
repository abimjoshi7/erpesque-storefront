import Link from "next/link";

import { AvailabilityBadge } from "@/components/availability-badge";
import type { Product, Tenant } from "@/lib/erp";
import { primaryImage } from "@/lib/media";
import { formatPrice } from "@/lib/money";

/**
 * One product in a listing.
 *
 * A plain `<img>`, not `next/image`. These are same-origin proxied bytes the
 * ERP already marks immutable for a year, so the optimizer would add a second
 * cache and a runtime dependency in front of a file that is already as cached
 * as it can be — and this app deploys to Workers, where that optimizer is the
 * fiddliest piece to keep working.
 *
 * The aspect box is fixed and the image is `object-contain`, because merchants
 * photograph stock however they photograph it: cropping to fill would cut the
 * top off a bottle, and letting each card size itself would give the grid a
 * ragged baseline.
 */
export function ProductCard({
  tenant,
  product,
  currency,
}: {
  tenant: string;
  product: Product;
  currency: NonNullable<Tenant["currency"]>;
}) {
  const image = primaryImage(tenant, product.images);

  return (
    <Link
      href={`/${tenant}/product/${product.slug}`}
      className="flex h-full flex-col rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <div className="mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- deliberate; see the note above.
          <img
            src={image}
            // The card already names the product beneath the picture, so
            // repeating it here would make a screen reader say it twice. An
            // empty alt marks the image as decorative, which is what it is.
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-neutral-400">No photo</span>
        )}
      </div>

      <div className="flex-1">
        {product.category ? (
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {product.category}
          </p>
        ) : null}
        <h2 className="mt-1 font-medium">{product.title}</h2>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="tabular-nums">{formatPrice(product.priceMinor, currency)}</p>
        <AvailabilityBadge availability={product.availability} />
      </div>
    </Link>
  );
}
