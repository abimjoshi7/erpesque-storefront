import Link from "next/link";

import { AvailabilityBadge } from "@/components/availability-badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Text, cx } from "@/design-system";
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
 * ragged baseline. The box is `bg-media` — white in both themes — because the
 * photographs are shot on white, and a dark box around a white photograph
 * reads as a sticker rather than a product.
 *
 * The whole card is one link and holds nothing else interactive: a button
 * nested in a link is invalid, and a shopper tapping a card on a phone should
 * never have to aim for which half of it they meant.
 */
export function ProductCard({
  tenant,
  product,
  currency,
  headingAs = "h2",
}: {
  tenant: string;
  product: Product;
  currency: NonNullable<Tenant["currency"]>;
  /** `h3` when the grid sits under a section heading rather than the page's h1. */
  headingAs?: "h2" | "h3";
}) {
  const image = primaryImage(tenant, product.images);
  const outOfStock = product.availability === "out_of_stock";
  const unpriced = product.priceMinor === null || product.priceMinor === undefined;

  return (
    <Link
      href={`/${tenant}/product/${product.slug}`}
      className="group flex h-full flex-col rounded-lg outline-offset-4"
    >
      <div
        className={cx(
          "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-line",
          "transition-[border-color,box-shadow] duration-(--duration-normal) ease-standard",
          "group-hover:border-line-strong group-hover:shadow-md",
          image ? "bg-media" : "bg-surface-subdued",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- deliberate; see the note above.
          <img
            src={image}
            // The card already names the product beneath the picture, so
            // repeating it here would make a screen reader say it twice. An
            // empty alt marks the image as decorative, which is what it is.
            alt=""
            loading="lazy"
            className={cx(
              "size-full object-contain p-3 sm:p-4",
              "transition-transform duration-(--duration-slow) ease-standard group-hover:scale-[1.04]",
              "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              outOfStock && "opacity-45 grayscale",
            )}
          />
        ) : (
          <ImagePlaceholder />
        )}

        {/* Said on the picture rather than only in the text beneath it, because
            the picture is what a shopper scanning a grid actually looks at. */}
        {outOfStock ? (
          <span className="absolute top-2.5 left-2.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-caption font-semibold text-ink-subdued shadow-xs">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        {product.category ? (
          <Text variant="labelSmall" tone="muted" className="truncate tracking-wide uppercase">
            {product.category}
          </Text>
        ) : null}
        <Text
          as={headingAs}
          variant="bodyLarge"
          className={cx(
            "mt-1 line-clamp-2 font-medium text-ink-strong text-pretty",
            "decoration-line-strong underline-offset-4 group-hover:underline",
            outOfStock && "text-ink-subdued",
          )}
        >
          {product.title}
        </Text>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2.5">
          <Text
            as="span"
            variant={unpriced ? "bodySmall" : "headlineMedium"}
            tone={unpriced ? "muted" : "strong"}
            className={cx("tabular-nums", !unpriced && "font-bold")}
          >
            {formatPrice(product.priceMinor, currency)}
          </Text>
          {/* The picture already says "Out of stock"; saying it twice in one
              card is how a badge stops being read. */}
          {outOfStock ? null : (
            <AvailabilityBadge availability={product.availability} variant="inline" />
          )}
        </div>
      </div>
    </Link>
  );
}
