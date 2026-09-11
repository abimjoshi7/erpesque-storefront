import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AddToCart } from "@/components/add-to-cart";
import { AvailabilityBadge } from "@/components/availability-badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Text } from "@/design-system";
import { fetchProduct, type Tenant } from "@/lib/erp";
import { mediaHref } from "@/lib/media";
import { formatPrice, priceAsNumber } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";

type PageProps = {
  params: Promise<{ tenant: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenant, slug } = await params;
  const result = await fetchProduct(tenant, slug);
  if (!result) return { title: "Product not found" };

  const { product, tenant: shop } = result;
  const images = (product.images ?? [])
    .map((path) => mediaHref(tenant, path))
    .filter((href): href is string => href !== null);

  const canonical = `/${encodeURIComponent(tenant)}/product/${encodeURIComponent(slug)}`;

  return {
    title: `${product.title} — ${shop.name}`,
    description: product.description ?? undefined,
    // A product reachable through a category or brand filter is the same page
    // at several URLs; naming one of them stops the duplicates competing with
    // each other in an index.
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title: product.title,
      description: product.description ?? undefined,
      type: "website",
      // Relative paths; Next resolves them against `metadataBase` at render.
      // These are the same immutable URLs the page itself uses, which is what
      // makes a share card possible at all — a presigned R2 link would have
      // expired by the time anyone scraped it.
      images,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { tenant, slug } = await params;
  const result = await fetchProduct(tenant, slug);

  // Unpublished, inactive, deleted and simply nonexistent all arrive here as
  // the same 404 — a shopper cannot tell which, which is the intent.
  if (!result) notFound();

  const { product, tenant: shop } = result;
  const images = (product.images ?? [])
    .map((path) => mediaHref(tenant, path))
    .filter((href): href is string => href !== null);

  const unpriced = product.priceMinor === null || product.priceMinor === undefined;
  const outOfStock = product.availability === "out_of_stock";

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <ProductJsonLd
        tenant={tenant}
        product={product}
        shopName={shop.name}
        currency={shop.currency}
        images={images}
      />
      {/* Real links, not decoration: the category a product sits in is a page
          of the shop, and a shopper who liked this bottle wants the shelf it
          came off. The listing already accepts these exact values as filters,
          so there is nothing to invent here. */}
      <nav aria-label="Breadcrumb" className="text-body-sm text-ink-subdued">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link
              href={`/${tenant}`}
              className="underline underline-offset-4 hover:text-ink-strong"
            >
              {shop.name}
            </Link>
          </li>
          {product.category ? (
            <li className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              <Link
                href={`/${tenant}?category=${encodeURIComponent(product.category)}`}
                className="underline underline-offset-4 hover:text-ink-strong"
              >
                {product.category}
              </Link>
            </li>
          ) : null}
        </ol>
      </nav>

      <article className="mt-8 grid gap-10 md:grid-cols-2">
        <Gallery images={images} title={product.title} />

        <div>
          <Text as="h1" variant="displayLarge" className="text-balance">
            {product.title}
          </Text>

          {product.brand ? (
            <p className="mt-1">
              <Link
                href={`/${tenant}?brand=${encodeURIComponent(product.brand)}`}
                className="text-body-sm text-ink-subdued underline underline-offset-4 hover:text-ink-strong"
              >
                More by {product.brand}
              </Link>
            </p>
          ) : null}

          <div className="mt-6 flex items-baseline gap-4">
            <Text as="p" variant="displayMedium" className="tabular-nums">
              {formatPrice(product.priceMinor, shop.currency!)}
            </Text>
            <AvailabilityBadge availability={product.availability} />
          </div>

          {product.description ? (
            <Text variant="bodyLarge" tone="subdued" className="mt-6 leading-relaxed">
              {product.description}
            </Text>
          ) : null}

          <AddToCart
            tenant={tenant}
            slug={product.slug!}
            title={product.title}
            disabled={unpriced}
            outOfStock={outOfStock}
            requireSignIn={shop.requireSignIn}
          />
        </div>
      </article>
    </main>
  );
}

/**
 * Structured data, so a search result can carry the price and whether the thing
 * is in stock.
 *
 * Emitted from the same values the page renders rather than a second fetch:
 * structured data that disagrees with the visible page is treated as
 * misrepresentation, and the surest way to make them disagree is to derive them
 * separately.
 *
 * `priceMinor` is divided here rather than formatted — schema.org wants a plain
 * decimal number, not "Rs 560".
 */
function ProductJsonLd({
  tenant,
  product,
  shopName,
  currency,
  images,
}: {
  tenant: string;
  product: {
    title: string;
    slug?: string | null;
    description?: string | null;
    brand?: string | null;
    priceMinor?: number | null;
    availability?: string | null;
  };
  shopName: string;
  currency: NonNullable<Tenant["currency"]> | undefined;
  images: string[];
}) {
  const url = absoluteUrl(
    `/${encodeURIComponent(tenant)}/product/${encodeURIComponent(product.slug ?? "")}`,
  );

  const availability =
    product.availability === "out_of_stock"
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(images.length ? { image: images.map((src) => absoluteUrl(src)) } : {}),
  };

  // No price, no offer. An Offer without a price is invalid structured data,
  // and inventing a zero would advertise the thing as free.
  const price = currency ? priceAsNumber(product.priceMinor, currency) : null;
  if (price !== null && currency?.code) {
    data.offers = {
      "@type": "Offer",
      url,
      price,
      priceCurrency: currency.code,
      availability,
      seller: { "@type": "Organization", name: shopName },
    };
  }

  return (
    <script
      type="application/ld+json"
      // The payload is JSON.stringify output, never raw user text, and the
      // `</script>` escape closes the one hole that leaves.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * The product's photographs, largest first.
 *
 * No lightbox, no carousel, no client component: the images are stacked and the
 * page scrolls. A gallery that needs JavaScript to show the second photograph
 * is a gallery that shows one photograph on a slow connection.
 *
 * The first image is eager and the rest lazy — the first is almost certainly
 * the largest thing above the fold, and deferring it would delay the moment the
 * page looks finished.
 */
function Gallery({ images, title }: { images: string[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-surface-subdued">
        <ImagePlaceholder />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {images.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- see the note on ProductCard.
        <img
          key={src}
          src={src}
          // Only the first carries the product name: the rest are further views
          // of the same thing, and repeating the name would have a screen
          // reader announce it once per photograph.
          alt={index === 0 ? title : ""}
          loading={index === 0 ? "eager" : "lazy"}
          // A fixed box, as on the card, because the ERP does not report a
          // photograph's dimensions and an `<img>` without them is a zero-height
          // element until the bytes land — so the page assembles, then jumps by
          // the height of every picture on it. `object-contain` keeps the
          // merchant's framing intact inside the box.
          className="aspect-square w-full rounded-lg bg-surface-subdued object-contain"
        />
      ))}
    </div>
  );
}
