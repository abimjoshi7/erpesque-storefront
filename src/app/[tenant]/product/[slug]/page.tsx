import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AddToCart } from "@/components/add-to-cart";
import { AvailabilityBadge } from "@/components/availability-badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { ProductCard } from "@/components/product-card";
import { Breadcrumbs, Container, Icon, Text, type IconName } from "@/design-system";
import { fetchCatalog, fetchProduct, type Tenant } from "@/lib/erp";
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

  // Imported catalogs often fill the description with the product's own name.
  // Printing it again under "Details" reads as a page nobody finished, so a
  // description that only repeats the title is left to the metadata.
  const description =
    product.description &&
    product.description.trim().toLowerCase() !== product.title.trim().toLowerCase()
      ? product.description
      : null;

  const shopHref = `/${tenant}`;
  const categoryHref = product.category
    ? `/${tenant}?category=${encodeURIComponent(product.category)}`
    : null;

  return (
    <Container as="main" className="pt-6 pb-16 sm:pt-8 lg:pb-24">
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
      <Breadcrumbs
        items={[
          { label: "Home", href: shopHref },
          ...(product.category && categoryHref
            ? [{ label: product.category, href: categoryHref }]
            : []),
          { label: product.title },
        ]}
      />

      <article className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
        <div className="lg:col-span-7">
          <Gallery images={images} title={product.title} />
        </div>

        {/* Sticky so the price and the button stay beside whichever photograph
            the shopper has scrolled to. `self-start` is what lets it: a grid
            item stretched to the row's full height has nowhere to stick. The
            offset clears the shop header, which is sticky too. */}
        <div className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          {product.brand ? (
            <Link
              href={`/${tenant}?brand=${encodeURIComponent(product.brand)}`}
              className="text-label font-semibold tracking-wide text-ink-subdued uppercase transition-colors duration-(--duration-fast) ease-standard hover:text-ink-strong"
            >
              {/* The eyebrow shows only the name; a screen reader gets the
                  whole sentence, since "Generic" alone is not a destination. */}
              <span className="sr-only">More by </span>
              {product.brand}
            </Link>
          ) : null}

          <Text as="h1" variant="display" className={product.brand ? "mt-2 text-balance" : "text-balance"}>
            {product.title}
          </Text>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Text as="p" variant="displayLarge" className="tabular-nums">
              {formatPrice(product.priceMinor, shop.currency!)}
            </Text>
            <AvailabilityBadge availability={product.availability} />
          </div>

          <hr className="my-6 border-line" />

          <AddToCart
            tenant={tenant}
            slug={product.slug!}
            title={product.title}
            disabled={unpriced}
            outOfStock={outOfStock}
            requireSignIn={shop.requireSignIn}
          />

          <Reassurance requireSignIn={shop.requireSignIn} />

          {description ? (
            <section aria-labelledby="product-details" className="mt-8">
              <Text as="h2" id="product-details" variant="headlineMedium">
                Details
              </Text>
              <Text
                variant="bodyLarge"
                tone="subdued"
                className="mt-3 leading-relaxed whitespace-pre-line"
              >
                {description}
              </Text>
            </section>
          ) : null}
        </div>
      </article>

      {/* Streamed after the product, so a slow listing never holds up the one
          thing the shopper came for. */}
      {product.category && categoryHref && shop.currency ? (
        <Suspense fallback={null}>
          <MoreInCategory
            tenant={tenant}
            category={product.category}
            categoryHref={categoryHref}
            slug={product.slug ?? slug}
            currency={shop.currency}
          />
        </Suspense>
      ) : null}
    </Container>
  );
}

/**
 * What ordering from this shop involves, stated once beside the button.
 *
 * Only things the shop actually does. Every line here is a promise the
 * storefront keeps by construction — the cart holds no prices, and payment is
 * on delivery — rather than copy about shipping or returns that the ERP has no
 * way to back.
 */
function Reassurance({ requireSignIn }: { requireSignIn: boolean }) {
  const points: Array<{ icon: IconName; title: string; body: string }> = [
    {
      icon: "cash",
      title: "Pay on delivery",
      body: "Nothing is charged online. You pay when your order arrives.",
    },
    {
      icon: "shield",
      title: "Today’s price, every time",
      body: "Your order is priced from the live catalog when you place it.",
    },
  ];
  if (requireSignIn) {
    points.push({
      icon: "user",
      title: "Sign in with a code",
      body: "We send a one-time code to your phone or email. No password.",
    });
  }

  return (
    <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
      {points.map((point) => (
        <li key={point.title} className="flex items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subdued text-ink-strong">
            <Icon name={point.icon} className="size-[18px]" />
          </span>
          <div>
            <Text variant="labelMedium" tone="strong">
              {point.title}
            </Text>
            <Text variant="bodySmall" tone="subdued" className="mt-0.5">
              {point.body}
            </Text>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A shelf of neighbours from the same category.
 *
 * The same one-minute cached listing read the catalog page makes, so it costs
 * the ERP nothing the shop was not already paying for. One more than the row
 * shows is asked for, because the product on this page is usually among them.
 *
 * A failure here renders nothing rather than throwing: the product above has
 * already been read, and a shopper who came for it should not be shown the
 * error page because the listing beneath it hiccuped.
 */
async function MoreInCategory({
  tenant,
  category,
  categoryHref,
  slug,
  currency,
}: {
  tenant: string;
  category: string;
  categoryHref: string;
  slug: string;
  currency: NonNullable<Tenant["currency"]>;
}) {
  let catalog: Awaited<ReturnType<typeof fetchCatalog>> = null;
  try {
    catalog = await fetchCatalog(tenant, { category, limit: 5 });
  } catch {
    return null;
  }

  const products = (catalog?.products ?? [])
    .filter((product) => product.slug !== slug)
    .slice(0, 4);
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="more-in-category"
      className="mt-16 border-t border-line pt-10 sm:mt-20"
    >
      <div className="flex items-end justify-between gap-4">
        <Text as="h2" id="more-in-category" variant="headlineLarge">
          More in {category}
        </Text>
        <Link
          href={categoryHref}
          className="inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-ink-strong hover:underline hover:underline-offset-4"
        >
          View all
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard tenant={tenant} product={product} currency={currency} />
          </li>
        ))}
      </ul>
    </section>
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

/** One photograph's frame. White in both themes: the stock shots are. */
const FRAME =
  "aspect-square w-full rounded-lg border border-line bg-media object-contain";

/**
 * The product's photographs, largest first.
 *
 * No lightbox, no carousel, no client component: the first photograph is shown
 * large and the rest sit beneath it — a grid on wider screens, a strip that
 * scrolls sideways on a phone. A gallery that needs JavaScript to show the
 * second photograph is a gallery that shows one photograph on a slow
 * connection; CSS scroll snapping gives the strip its feel without any.
 *
 * The first image is eager and the rest lazy — the first is almost certainly
 * the largest thing above the fold, and deferring it would delay the moment the
 * page looks finished.
 */
function Gallery({ images, title }: { images: string[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-line bg-media">
        <ImagePlaceholder />
      </div>
    );
  }

  const [first, ...rest] = images;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note on ProductCard. */}
      <img
        src={first}
        alt={title}
        loading="eager"
        // A fixed box, as on the card, because the ERP does not report a
        // photograph's dimensions and an `<img>` without them is a zero-height
        // element until the bytes land — so the page assembles, then jumps by
        // the height of every picture on it. `object-contain` keeps the
        // merchant's framing intact inside the box, and the padding keeps a
        // tightly cropped packshot off the frame's edge.
        className={`${FRAME} p-6 sm:p-10`}
      />

      {rest.length > 0 ? (
        // Bleeds to the screen edge on a phone so the next photograph peeks in
        // from the side — the cue that the strip scrolls.
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
          {rest.map((src) => (
            <li key={src} className="w-3/4 shrink-0 snap-start sm:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- see the note on ProductCard. */}
              <img
                src={src}
                // Only the first carries the product name: the rest are further
                // views of the same thing, and repeating the name would have a
                // screen reader announce it once per photograph.
                alt=""
                loading="lazy"
                className={`${FRAME} p-6`}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
