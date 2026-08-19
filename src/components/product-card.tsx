import Link from "next/link";

import { AvailabilityBadge } from "@/components/availability-badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Text } from "@/design-system";
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
      className="flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-xs transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard hover:border-line-strong hover:shadow-md"
    >
      <div className="mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-surface-subdued">
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
          <ImagePlaceholder />
        )}
      </div>

      <div className="flex-1">
        {product.category ? (
          <Text variant="labelSmall" tone="muted" className="uppercase">
            {product.category}
          </Text>
        ) : null}
        <Text as="h2" variant="headlineSmall" className="mt-1">
          {product.title}
        </Text>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <Text variant="titleLarge" tone="strong" className="tabular-nums">
          {formatPrice(product.priceMinor, currency)}
        </Text>
        <AvailabilityBadge availability={product.availability} />
      </div>
    </Link>
  );
}
